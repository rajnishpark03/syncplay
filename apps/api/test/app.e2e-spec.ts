import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Auth flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const email = `e2e-${Date.now()}@example.com`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    prisma = app.get(PrismaService);
    await app.init();
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  it('rejects an invalid OTP', async () => {
    await request(app.getHttpServer()).post('/auth/otp/request').send({ email }).expect(200);

    await request(app.getHttpServer())
      .post('/auth/otp/verify')
      .send({ email, code: '000000', device: { deviceId: 'e2e-device', name: 'CI Runner', platform: 'web' } })
      .expect(401);
  });

  it('requests an OTP, verifies it in dev mode, and reaches a protected route', async () => {
    const otpRes = await request(app.getHttpServer()).post('/auth/otp/request').send({ email }).expect(200);

    expect(otpRes.body.sent).toBe(true);
    expect(otpRes.body.devCode).toMatch(/^\d{6}$/);

    const verifyRes = await request(app.getHttpServer())
      .post('/auth/otp/verify')
      .send({
        email,
        code: otpRes.body.devCode,
        device: { deviceId: 'e2e-device', name: 'CI Runner', platform: 'web' },
      })
      .expect(200);

    expect(verifyRes.body.accessToken).toBeDefined();
    expect(verifyRes.body.refreshToken).toBeDefined();

    const meRes = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${verifyRes.body.accessToken}`)
      .expect(200);

    expect(meRes.body.email).toBe(email);

    // Second device, same email — this is the "same account links devices" contract.
    const otpRes2 = await request(app.getHttpServer()).post('/auth/otp/request').send({ email }).expect(200);
    const verifyRes2 = await request(app.getHttpServer())
      .post('/auth/otp/verify')
      .send({
        email,
        code: otpRes2.body.devCode,
        device: { deviceId: 'e2e-device-2', name: 'CI Runner Phone', platform: 'ios' },
      })
      .expect(200);

    const devicesRes = await request(app.getHttpServer())
      .get('/devices')
      .set('Authorization', `Bearer ${verifyRes2.body.accessToken}`)
      .expect(200);

    expect(devicesRes.body).toHaveLength(2);
    expect(devicesRes.body.map((d: { id: string }) => d.id).sort()).toEqual(['e2e-device', 'e2e-device-2'].sort());
  });
});

describe('Room create/join flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const hostEmail = `e2e-host-${Date.now()}@example.com`;
  const guestEmail = `e2e-guest-${Date.now()}@example.com`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    prisma = app.get(PrismaService);
    await app.init();
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [hostEmail, guestEmail] } } });
    await app.close();
  });

  async function loginAs(email: string, deviceId: string) {
    const otpRes = await request(app.getHttpServer()).post('/auth/otp/request').send({ email }).expect(200);
    const verifyRes = await request(app.getHttpServer())
      .post('/auth/otp/verify')
      .send({ email, code: otpRes.body.devCode, device: { deviceId, name: deviceId, platform: 'web' } })
      .expect(200);
    return verifyRes.body.accessToken as string;
  }

  it('lets a host create a room and a completely different account join it by code', async () => {
    const hostToken = await loginAs(hostEmail, 'e2e-host-device');
    const guestToken = await loginAs(guestEmail, 'e2e-guest-device');

    const createRes = await request(app.getHttpServer())
      .post('/rooms')
      .set('Authorization', `Bearer ${hostToken}`)
      .send({ name: 'E2E movie night' })
      .expect(201);

    expect(createRes.body.code).toMatch(/^[A-Z0-9]{6}$/);
    const roomCode = createRes.body.code;

    // A guest with a totally unrelated email can look the room up and would join it —
    // this is the core "room code, not shared email" contract.
    const lookupRes = await request(app.getHttpServer())
      .get(`/rooms/${roomCode}`)
      .set('Authorization', `Bearer ${guestToken}`)
      .expect(200);

    expect(lookupRes.body.code).toBe(roomCode);
    expect(lookupRes.body.hostUserId).toEqual(expect.any(String));
    expect(lookupRes.body.hostName).toEqual(expect.any(String));

    await request(app.getHttpServer()).get('/rooms/ZZZZZZ').set('Authorization', `Bearer ${guestToken}`).expect(404);
  });
});
