import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

/**
 * Thin wrapper around ioredis used for device presence (short-TTL keys) and
 * as the pub/sub backbone for the Socket.IO Redis adapter, so the sync/voice
 * gateways work correctly across multiple API instances.
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client: Redis;

  constructor(url: string) {
    this.client = new Redis(url, { maxRetriesPerRequest: 3 });
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  presenceKey(deviceId: string) {
    return `presence:device:${deviceId}`;
  }

  async setDeviceOnline(deviceId: string, socketId: string, ttlSeconds = 60) {
    await this.client.set(this.presenceKey(deviceId), socketId, 'EX', ttlSeconds);
  }

  async heartbeat(deviceId: string, ttlSeconds = 60) {
    await this.client.expire(this.presenceKey(deviceId), ttlSeconds);
  }

  async clearDevice(deviceId: string) {
    await this.client.del(this.presenceKey(deviceId));
  }

  async isOnline(deviceId: string) {
    return (await this.client.exists(this.presenceKey(deviceId))) === 1;
  }
}
