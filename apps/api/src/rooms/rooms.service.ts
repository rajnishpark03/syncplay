import { Injectable, NotFoundException } from '@nestjs/common';
import { RoomInfo } from '@syncplay/shared';
import { PrismaService } from '../prisma/prisma.service';

// Excludes visually-ambiguous characters (0/O, 1/I/L) so a spoken/typed code
// never gets mistyped by the person receiving it.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

@Injectable()
export class RoomsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(hostUserId: string, name?: string): Promise<RoomInfo> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = this.generateCode();
      const existing = await this.prisma.room.findUnique({ where: { code } });
      if (existing) continue;

      const room = await this.prisma.room.create({
        data: { code, hostUserId, name },
        include: { host: true },
      });
      return this.toDto(room);
    }
    throw new Error('Failed to allocate a unique room code, please retry');
  }

  async findByCode(code: string): Promise<RoomInfo> {
    const room = await this.prisma.room.findUnique({
      where: { code: code.toUpperCase() },
      include: { host: true },
    });
    if (!room) throw new NotFoundException('Room not found — check the code and try again');
    return this.toDto(room);
  }

  async touch(code: string) {
    await this.prisma.room.update({ where: { code }, data: {} }).catch(() => undefined);
  }

  private generateCode(): string {
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
      code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    }
    return code;
  }

  private toDto(room: { code: string; hostUserId: string; name: string | null; createdAt: Date; host: { name: string | null; email: string } }): RoomInfo {
    return {
      code: room.code,
      hostUserId: room.hostUserId,
      hostName: room.host.name ?? room.host.email.split('@')[0],
      name: room.name,
      createdAt: room.createdAt.toISOString(),
    };
  }
}
