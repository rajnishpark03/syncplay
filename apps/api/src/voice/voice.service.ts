import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

/**
 * Tracks who is currently in a room's voice channel. Actual media never
 * touches the server — this only manages membership so the gateway knows
 * who to relay WebRTC offer/answer/ICE signaling between (mesh of at most 2
 * peers today, but the room model scales to more devices later).
 */
@Injectable()
export class VoiceService {
  constructor(private readonly redis: RedisService) {}

  private key(roomCode: string) {
    return `voice:room:${roomCode}`;
  }

  async join(roomCode: string, deviceId: string): Promise<string[]> {
    await this.redis.client.sadd(this.key(roomCode), deviceId);
    return this.participants(roomCode);
  }

  async leave(roomCode: string, deviceId: string): Promise<string[]> {
    await this.redis.client.srem(this.key(roomCode), deviceId);
    return this.participants(roomCode);
  }

  async participants(roomCode: string): Promise<string[]> {
    return this.redis.client.smembers(this.key(roomCode));
  }
}
