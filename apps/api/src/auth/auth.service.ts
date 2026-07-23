import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash, randomInt } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';
import { DeviceInputDto } from './dto/verify-otp.dto';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface AccessTokenClaims {
  sub: string; // userId
  email: string;
  deviceId: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly activity: ActivityService,
  ) {}

  async requestOtp(email: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const ttlSeconds = this.config.get<number>('otp.ttlSeconds')!;
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const codeHash = await bcrypt.hash(code, 10);
    const existingUser = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });

    await this.prisma.otpCode.create({
      data: {
        email: normalizedEmail,
        codeHash,
        userId: existingUser?.id,
        expiresAt: new Date(Date.now() + ttlSeconds * 1000),
      },
    });

    const devMode = this.config.get<boolean>('otp.devMode');
    if (devMode) {
      this.logger.warn(`[DEV MODE] OTP for ${normalizedEmail}: ${code} (expires in ${ttlSeconds}s)`);
      return { sent: true, devCode: code, expiresInSeconds: ttlSeconds };
    }

    // Production path: plug a transactional email provider here (Resend/SES/SMTP).
    // Left intentionally unimplemented — see docs/DEPLOYMENT.md for wiring instructions.
    this.logger.log(`OTP requested for ${normalizedEmail}, would be emailed in production mode`);
    return { sent: true, expiresInSeconds: ttlSeconds };
  }

  async verifyOtp(email: string, code: string, device: DeviceInputDto): Promise<AuthTokens & { userId: string }> {
    const normalizedEmail = email.trim().toLowerCase();
    const maxAttempts = this.config.get<number>('otp.maxAttempts')!;

    const otp = await this.prisma.otpCode.findFirst({
      where: { email: normalizedEmail, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp || otp.expiresAt < new Date()) {
      throw new UnauthorizedException('OTP expired or not found, please request a new one');
    }
    if (otp.attempts >= maxAttempts) {
      throw new UnauthorizedException('Too many attempts, please request a new OTP');
    }

    const valid = await bcrypt.compare(code, otp.codeHash);
    if (!valid) {
      await this.prisma.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
      throw new UnauthorizedException('Invalid OTP code');
    }

    const user = await this.prisma.user.upsert({
      where: { email: normalizedEmail },
      update: {},
      create: { email: normalizedEmail },
    });

    await this.prisma.otpCode.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });

    const isNewDevice = !(await this.prisma.device.findUnique({ where: { id: device.deviceId } }));

    await this.prisma.device.upsert({
      where: { id: device.deviceId },
      update: { name: device.name, platform: device.platform, appVersion: device.appVersion, lastSeenAt: new Date() },
      create: {
        id: device.deviceId,
        userId: user.id,
        name: device.name,
        platform: device.platform,
        appVersion: device.appVersion,
      },
    });

    await this.activity.record(user.id, device.deviceId, 'device_connected', `${device.name} linked to your account`);

    const tokens = await this.issueTokens(user.id, normalizedEmail, device.deviceId);
    this.logger.log(`Device ${device.deviceId} (${isNewDevice ? 'new' : 'existing'}) authenticated for ${normalizedEmail}`);
    return { ...tokens, userId: user.id };
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    let claims: AccessTokenClaims;
    try {
      claims = this.jwt.verify(refreshToken, { secret: this.config.get<string>('jwt.refreshSecret') });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired or revoked');
    }

    await this.prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
    return this.issueTokens(claims.sub, claims.email, claims.deviceId);
  }

  async logout(userId: string, deviceId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, deviceId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl, createdAt: user.createdAt };
  }

  verifyAccessToken(token: string): AccessTokenClaims {
    return this.jwt.verify<AccessTokenClaims>(token, { secret: this.config.get<string>('jwt.accessSecret') });
  }

  private async issueTokens(userId: string, email: string, deviceId: string): Promise<AuthTokens> {
    const claims: AccessTokenClaims = { sub: userId, email, deviceId };
    const accessTtl = this.config.get<string>('jwt.accessTtl')!;
    const refreshTtl = this.config.get<string>('jwt.refreshTtl')!;

    const accessToken = this.jwt.sign(claims, {
      secret: this.config.get<string>('jwt.accessSecret'),
      expiresIn: accessTtl,
    });
    const refreshToken = this.jwt.sign(claims, {
      secret: this.config.get<string>('jwt.refreshSecret'),
      expiresIn: refreshTtl,
    });

    await this.prisma.refreshToken.create({
      data: {
        userId,
        deviceId,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: new Date(Date.now() + this.ttlToMs(refreshTtl)),
      },
    });

    return { accessToken, refreshToken, expiresIn: this.ttlToMs(accessTtl) / 1000 };
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private ttlToMs(ttl: string): number {
    const match = /^(\d+)([smhd])$/.exec(ttl);
    if (!match) return 15 * 60 * 1000;
    const value = parseInt(match[1], 10);
    const unit = match[2];
    const multipliers: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
    return value * multipliers[unit];
  }
}
