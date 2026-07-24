import { Injectable } from '@nestjs/common';
import { GameId, GamePlayer, GameSession } from '@orbit/shared';
import { RedisService } from '../redis/redis.service';

/**
 * Stores one game session per room in Redis.
 *
 * Intentionally **game-agnostic**: `state` is an opaque JSON blob written by
 * whichever client made the move. The only rule the server enforces is turn
 * ownership, which is all that's needed to keep two clients from writing
 * conflicting states at the same time. Adding a new game therefore requires
 * zero changes here.
 */
@Injectable()
export class GamesService {
  constructor(private readonly redis: RedisService) {}

  private key(roomCode: string) {
    return `game:session:${roomCode}`;
  }

  async get(roomCode: string): Promise<GameSession | null> {
    const raw = await this.redis.client.get(this.key(roomCode));
    return raw ? (JSON.parse(raw) as GameSession) : null;
  }

  async start(
    roomCode: string,
    gameId: GameId,
    players: GamePlayer[],
    state: unknown,
    turnSeat: number,
  ): Promise<GameSession> {
    const session: GameSession = {
      roomCode,
      gameId,
      players,
      turnSeat,
      state,
      finished: false,
      updatedAt: new Date().toISOString(),
    };
    await this.write(roomCode, session);
    return session;
  }

  /**
   * Applies a move. Returns null if the mover isn't the seated player whose
   * turn it is (stale click, or two devices racing) so the gateway can ignore
   * it instead of corrupting the board.
   */
  async move(
    roomCode: string,
    deviceId: string,
    state: unknown,
    turnSeat: number,
    finished: boolean,
  ): Promise<GameSession | null> {
    const current = await this.get(roomCode);
    if (!current || current.finished) return null;

    const mover = current.players.find((p) => p.deviceId === deviceId);
    if (!mover || mover.seat !== current.turnSeat) return null;

    const next: GameSession = { ...current, state, turnSeat, finished, updatedAt: new Date().toISOString() };
    await this.write(roomCode, next);
    return next;
  }

  async end(roomCode: string): Promise<void> {
    await this.redis.client.del(this.key(roomCode));
  }

  private async write(roomCode: string, session: GameSession) {
    // Sessions expire after a day of inactivity so abandoned games don't pile up.
    await this.redis.client.set(this.key(roomCode), JSON.stringify(session), 'EX', 60 * 60 * 24);
  }
}
