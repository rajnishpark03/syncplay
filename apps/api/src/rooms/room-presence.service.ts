import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';
import { RoomMember, SOCKET_ROOM_PREFIX } from '@orbit/shared';
import { RoomsService } from './rooms.service';

interface SocketIdentity {
  deviceId?: string;
  deviceName?: string;
  userId?: string;
  platform?: string;
}

/**
 * Who is in a room *right now*.
 *
 * Derived from live Socket.IO room membership rather than a separate Redis
 * set. A side-set has to be cleaned up by hand on every disconnect, and any
 * missed cleanup (server restart, crash, dropped connection) leaves ghost
 * members behind — or drops real ones — which is what made screen share and
 * games think nobody else was there. The socket server already knows exactly
 * who is connected, and with the Redis adapter `fetchSockets()` covers every
 * instance, so there is nothing to keep in sync.
 */
@Injectable()
export class RoomPresenceService {
  constructor(private readonly roomsService: RoomsService) {}

  private channel(roomCode: string) {
    return `${SOCKET_ROOM_PREFIX}${roomCode}`;
  }

  async members(server: Server, roomCode: string): Promise<RoomMember[]> {
    const [sockets, room] = await Promise.all([
      server.in(this.channel(roomCode)).fetchSockets(),
      this.roomsService.findByCode(roomCode).catch(() => null),
    ]);

    const byDevice = new Map<string, RoomMember>();
    for (const socket of sockets) {
      const data = socket.data as SocketIdentity;
      if (!data?.deviceId) continue;
      // A device that reconnected may briefly have two sockets; keep one entry.
      byDevice.set(data.deviceId, {
        deviceId: data.deviceId,
        deviceName: data.deviceName ?? 'Device',
        platform: (data.platform as RoomMember['platform']) ?? 'web',
        userId: data.userId ?? '',
        isHost: Boolean(room && data.userId === room.hostUserId),
      });
    }

    return [...byDevice.values()];
  }
}
