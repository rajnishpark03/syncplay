import { Injectable } from '@nestjs/common';
import { RoomMember } from '@syncplay/shared';
import { RedisService } from '../redis/redis.service';
import { DevicesService } from '../devices/devices.service';
import { RoomsService } from './rooms.service';

/** Tracks which devices are currently connected inside a given room. */
@Injectable()
export class RoomPresenceService {
  constructor(
    private readonly redis: RedisService,
    private readonly devicesService: DevicesService,
    private readonly roomsService: RoomsService,
  ) {}

  private key(roomCode: string) {
    return `room:members:${roomCode}`;
  }

  async join(roomCode: string, deviceId: string) {
    await this.redis.client.sadd(this.key(roomCode), deviceId);
  }

  async leave(roomCode: string, deviceId: string) {
    await this.redis.client.srem(this.key(roomCode), deviceId);
  }

  async members(roomCode: string): Promise<RoomMember[]> {
    const [deviceIds, room] = await Promise.all([
      this.redis.client.smembers(this.key(roomCode)),
      this.roomsService.findByCode(roomCode),
    ]);

    const devices = await Promise.all(deviceIds.map((id) => this.devicesService.findById(id)));

    return devices
      .filter((d): d is NonNullable<typeof d> => d !== null)
      .map((device) => ({
        deviceId: device.id,
        deviceName: device.name,
        platform: device.platform as RoomMember['platform'],
        userId: device.userId,
        isHost: device.userId === room.hostUserId,
      }));
  }
}
