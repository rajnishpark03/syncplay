import { Injectable } from '@nestjs/common';
import { ActivityEntry, ActivityType } from '@syncplay/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async record(
    userId: string,
    deviceId: string | null,
    type: ActivityType,
    message: string,
    roomCode?: string | null,
  ): Promise<ActivityEntry> {
    const entry = await this.prisma.activityLog.create({
      data: { userId, deviceId, type, message, roomCode },
      include: { device: true },
    });

    return this.toDto(entry);
  }

  /** Account-level feed (device connect/disconnect etc — not tied to any one room). */
  async recentForUser(userId: string, limit = 20): Promise<ActivityEntry[]> {
    const entries = await this.prisma.activityLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { device: true },
    });
    return entries.map((entry) => this.toDto(entry));
  }

  /** Room-scoped feed (what the Sync screen shows for the active session). */
  async recentForRoom(roomCode: string, limit = 20): Promise<ActivityEntry[]> {
    const entries = await this.prisma.activityLog.findMany({
      where: { roomCode },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { device: true },
    });
    return entries.map((entry) => this.toDto(entry));
  }

  private toDto(entry: {
    id: string;
    userId: string;
    deviceId: string | null;
    roomCode: string | null;
    type: string;
    message: string;
    createdAt: Date;
    device?: { name: string } | null;
  }): ActivityEntry {
    return {
      id: entry.id,
      userId: entry.userId,
      deviceId: entry.deviceId,
      deviceName: entry.device?.name,
      roomCode: entry.roomCode,
      type: entry.type as ActivityType,
      message: entry.message,
      createdAt: entry.createdAt.toISOString(),
    };
  }
}
