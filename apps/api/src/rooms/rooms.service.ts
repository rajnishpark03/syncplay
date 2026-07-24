import { Injectable, NotFoundException } from '@nestjs/common';
import { RoomInfo } from '@orbit/shared';
import { PrismaService } from '../prisma/prisma.service';

// Excludes visually-ambiguous characters (0/O, 1/I/L) so a spoken/typed code
// never gets mistyped by the person receiving it.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

/**
 * Rooms get a warm, romantic name so a session reads like "Moonlight Cove"
 * instead of a raw code. The code is still what people share to join — the
 * name is purely how the room presents itself in the UI.
 */
const NAME_ADJECTIVES = [
  'Moonlit', 'Velvet', 'Golden', 'Starlit', 'Cosy', 'Dreamy', 'Amber', 'Rosy',
  'Secret', 'Hushed', 'Twilight', 'Sunlit', 'Silver', 'Honey', 'Midnight', 'Softly',
];
const NAME_NOUNS = [
  'Orbit', 'Cove', 'Balcony', 'Rooftop', 'Lantern', 'Hideaway', 'Sofa', 'Window',
  'Terrace', 'Harbour', 'Meadow', 'Bonfire', 'Garden', 'Cabin', 'Nook', 'Skyline',
];

function randomRomanticName(): string {
  const adjective = NAME_ADJECTIVES[Math.floor(Math.random() * NAME_ADJECTIVES.length)];
  const noun = NAME_NOUNS[Math.floor(Math.random() * NAME_NOUNS.length)];
  return `${adjective} ${noun}`;
}

@Injectable()
export class RoomsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(hostUserId: string, name?: string): Promise<RoomInfo> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = this.generateCode();
      const existing = await this.prisma.room.findUnique({ where: { code } });
      if (existing) continue;

      const room = await this.prisma.room.create({
        // No name given → pick a fresh romantic one for this session.
        data: { code, hostUserId, name: name?.trim() || randomRomanticName() },
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
