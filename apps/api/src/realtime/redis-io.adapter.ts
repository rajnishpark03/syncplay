import { IoAdapter } from '@nestjs/platform-socket.io';
import { INestApplicationContext } from '@nestjs/common';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { resolveCorsOrigin } from '../config/cors';

/**
 * Backs the Socket.IO server with Redis pub/sub so sync/voice events fan out
 * correctly if the API is ever scaled to multiple instances behind a load
 * balancer — a single in-memory adapter would silently drop events between
 * two devices connected to different instances.
 */
export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor?: ReturnType<typeof createAdapter>;

  constructor(app: INestApplicationContext) {
    super(app);
  }

  async connect(redisUrl: string) {
    const pubClient = new Redis(redisUrl);
    const subClient = pubClient.duplicate();
    this.adapterConstructor = createAdapter(pubClient, subClient);
  }

  createIOServer(port: number, options?: ServerOptions) {
    const server = super.createIOServer(port, {
      ...options,
      cors: { origin: resolveCorsOrigin(), credentials: true },
    });
    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }
    return server;
  }
}
