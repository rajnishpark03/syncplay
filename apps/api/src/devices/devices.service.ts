import { Injectable } from '@nestjs/common';
import { DeviceInfo, NetworkQuality } from '@syncplay/shared';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class DevicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async listForUser(userId: string): Promise<DeviceInfo[]> {
    const devices = await this.prisma.device.findMany({
      where: { userId },
      orderBy: { lastSeenAt: 'desc' },
    });
    return devices.map((d) => this.toDto(d));
  }

  async markOnline(deviceId: string, socketId: string) {
    await this.redis.setDeviceOnline(deviceId, socketId);
    return this.prisma.device.update({
      where: { id: deviceId },
      data: { isOnline: true, socketId, lastSeenAt: new Date() },
    });
  }

  async markOffline(deviceId: string) {
    await this.redis.clearDevice(deviceId);
    return this.prisma.device.update({
      where: { id: deviceId },
      data: { isOnline: false, socketId: null, lastSeenAt: new Date() },
    });
  }

  async heartbeat(
    deviceId: string,
    data: { batteryLevel?: number | null; networkQuality?: NetworkQuality; pingMs?: number },
  ) {
    await this.redis.heartbeat(deviceId);
    return this.prisma.device.update({
      where: { id: deviceId },
      data: {
        lastSeenAt: new Date(),
        ...(data.batteryLevel !== undefined ? { batteryLevel: data.batteryLevel } : {}),
        ...(data.networkQuality !== undefined ? { networkQuality: data.networkQuality } : {}),
        ...(data.pingMs !== undefined ? { pingMs: data.pingMs } : {}),
      },
    });
  }

  async findById(deviceId: string) {
    return this.prisma.device.findUnique({ where: { id: deviceId } });
  }

  toDto(device: {
    id: string;
    userId: string;
    name: string;
    platform: string;
    appVersion: string | null;
    isOnline: boolean;
    networkQuality: string;
    pingMs: number | null;
    batteryLevel: number | null;
    lastSeenAt: Date;
    createdAt: Date;
  }): DeviceInfo {
    return {
      id: device.id,
      userId: device.userId,
      name: device.name,
      platform: device.platform as DeviceInfo['platform'],
      appVersion: device.appVersion ?? undefined,
      isOnline: device.isOnline,
      networkQuality: device.networkQuality as NetworkQuality,
      pingMs: device.pingMs,
      batteryLevel: device.batteryLevel,
      lastSeenAt: device.lastSeenAt.toISOString(),
      createdAt: device.createdAt.toISOString(),
    };
  }
}
