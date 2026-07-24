import { Injectable, Logger } from '@nestjs/common';
import { MediaSyncState, PlaybackState, TrackInfo } from '@orbit/shared';
import { RedisService } from '../redis/redis.service';
import { PrismaService } from '../prisma/prisma.service';

const IDLE_STATE: Omit<MediaSyncState, 'roomCode'> = {
  track: null,
  queue: [],
  state: 'idle',
  anchorPositionMs: 0,
  anchorServerTimeMs: 0,
  playbackRate: 1,
  volume: 1,
  updatedByDeviceId: null,
  updatedAt: new Date(0).toISOString(),
};

/**
 * Source of truth for "where is playback right now" per room.
 *
 * State lives in Redis (sub-millisecond read/write, and shared across API
 * instances) so the play/pause/seek path never waits on Postgres. Every
 * mutation is mirrored to Postgres afterwards (fire-and-forget) purely for
 * durability across restarts and the Sync screen's "resume where you left
 * off" behaviour — it is never on the hot broadcast path. The queue itself
 * is Redis-only (not persisted) — losing an upcoming-tracks list on a
 * restart is an acceptable tradeoff for not persisting it on every add/remove.
 *
 * The state a client receives is a *server-anchored* position
 * (anchorPositionMs @ anchorServerTimeMs + playbackRate), not a raw
 * "currentTime" number. That's what lets every device compute an identical
 * live position irrespective of message arrival jitter — see
 * docs/SOCKET_EVENTS.md for the derivation formula and drift-correction
 * protocol.
 */
@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  private key(roomCode: string) {
    return `sync:state:${roomCode}`;
  }

  private endedKey(roomCode: string, trackId: string) {
    return `sync:ended:${roomCode}:${trackId}`;
  }

  async getState(roomCode: string): Promise<MediaSyncState> {
    const raw = await this.redis.client.get(this.key(roomCode));
    if (raw) return JSON.parse(raw) as MediaSyncState;

    const persisted = await this.prisma.mediaSession.findUnique({ where: { roomCode } });
    const state = persisted ? this.fromPersisted(roomCode, persisted) : { roomCode, ...IDLE_STATE };
    await this.writeCache(roomCode, state);
    return state;
  }

  async play(roomCode: string, deviceId: string, positionMs: number): Promise<MediaSyncState> {
    return this.mutate(roomCode, (current) => ({
      ...current,
      state: 'playing' as PlaybackState,
      anchorPositionMs: positionMs,
      anchorServerTimeMs: Date.now(),
      updatedByDeviceId: deviceId,
    }));
  }

  async pause(roomCode: string, deviceId: string, positionMs: number): Promise<MediaSyncState> {
    return this.mutate(roomCode, (current) => ({
      ...current,
      state: 'paused' as PlaybackState,
      anchorPositionMs: positionMs,
      anchorServerTimeMs: Date.now(),
      updatedByDeviceId: deviceId,
    }));
  }

  async seek(roomCode: string, deviceId: string, positionMs: number): Promise<MediaSyncState> {
    return this.mutate(roomCode, (current) => ({
      ...current,
      anchorPositionMs: positionMs,
      anchorServerTimeMs: Date.now(),
      updatedByDeviceId: deviceId,
    }));
  }

  /** Loads a track immediately, replacing whatever is currently playing (queue untouched). */
  async changeTrack(
    roomCode: string,
    deviceId: string,
    track: TrackInfo,
    positionMs: number,
    autoplay: boolean,
  ): Promise<MediaSyncState> {
    return this.mutate(roomCode, (current) => ({
      ...current,
      track,
      state: (autoplay ? 'playing' : 'paused') as PlaybackState,
      anchorPositionMs: positionMs,
      anchorServerTimeMs: Date.now(),
      updatedByDeviceId: deviceId,
    }));
  }

  async changeSpeed(roomCode: string, deviceId: string, rate: number, positionMs: number): Promise<MediaSyncState> {
    return this.mutate(roomCode, (current) => ({
      ...current,
      playbackRate: rate,
      anchorPositionMs: positionMs,
      anchorServerTimeMs: Date.now(),
      updatedByDeviceId: deviceId,
    }));
  }

  async changeVolume(roomCode: string, deviceId: string, volume: number): Promise<MediaSyncState> {
    return this.mutate(roomCode, (current) => ({
      ...current,
      volume,
      updatedByDeviceId: deviceId,
    }));
  }

  /** Adds a track to the end of the up-next queue without interrupting current playback. */
  async addToQueue(roomCode: string, track: TrackInfo): Promise<MediaSyncState> {
    return this.mutate(roomCode, (current) => ({
      ...current,
      queue: [...current.queue, track],
    }));
  }

  async removeFromQueue(roomCode: string, trackId: string): Promise<MediaSyncState> {
    return this.mutate(roomCode, (current) => ({
      ...current,
      queue: current.queue.filter((t) => t.id !== trackId),
    }));
  }

  /**
   * Advances to the next queued track (used for both an explicit "skip" and
   * an automatic advance when the current track ends). If the queue is
   * empty, playback just stops on the current track instead of looping.
   */
  async advance(roomCode: string, deviceId: string): Promise<MediaSyncState> {
    return this.mutate(roomCode, (current) => {
      const [next, ...rest] = current.queue;
      if (!next) {
        return { ...current, state: 'paused' as PlaybackState, updatedByDeviceId: deviceId };
      }
      return {
        ...current,
        track: next,
        queue: rest,
        state: 'playing' as PlaybackState,
        anchorPositionMs: 0,
        anchorServerTimeMs: Date.now(),
        updatedByDeviceId: deviceId,
      };
    });
  }

  /**
   * Multiple devices in the room can independently notice the same track
   * ended and report it — only the first report within a short window should
   * actually advance the queue. Returns true if this call "won" and should
   * proceed to call `advance()`.
   */
  async claimEnded(roomCode: string, trackId: string): Promise<boolean> {
    const result = await this.redis.client.set(this.endedKey(roomCode, trackId), '1', 'EX', 30, 'NX');
    return result === 'OK';
  }

  /** Live position of the current session, independent of last-broadcast time. */
  livePositionMs(state: MediaSyncState, atMs = Date.now()): number {
    if (state.state !== 'playing') return state.anchorPositionMs;
    const elapsed = (atMs - state.anchorServerTimeMs) * state.playbackRate;
    return Math.max(0, state.anchorPositionMs + elapsed);
  }

  private async mutate(roomCode: string, updater: (current: MediaSyncState) => MediaSyncState): Promise<MediaSyncState> {
    const current = await this.getState(roomCode);
    const next: MediaSyncState = { ...updater(current), roomCode, updatedAt: new Date().toISOString() };
    await this.writeCache(roomCode, next);
    this.persist(roomCode, next).catch((err) => this.logger.error(`Failed to persist media session for room ${roomCode}`, err));
    return next;
  }

  private async writeCache(roomCode: string, state: MediaSyncState) {
    await this.redis.client.set(this.key(roomCode), JSON.stringify(state), 'EX', 60 * 60 * 24);
  }

  private async persist(roomCode: string, state: MediaSyncState) {
    await this.prisma.mediaSession.upsert({
      where: { roomCode },
      create: {
        roomCode,
        trackId: state.track?.id,
        mediaType: state.track?.mediaType,
        title: state.track?.title,
        subtitle: state.track?.subtitle,
        artworkUrl: state.track?.artworkUrl,
        sourceUrl: state.track?.sourceUrl,
        durationMs: state.track?.durationMs ?? 0,
        state: state.state,
        anchorPositionMs: state.anchorPositionMs,
        anchorServerTime: new Date(state.anchorServerTimeMs),
        playbackRate: state.playbackRate,
        volume: state.volume,
        updatedByDeviceId: state.updatedByDeviceId,
      },
      update: {
        trackId: state.track?.id,
        mediaType: state.track?.mediaType,
        title: state.track?.title,
        subtitle: state.track?.subtitle,
        artworkUrl: state.track?.artworkUrl,
        sourceUrl: state.track?.sourceUrl,
        durationMs: state.track?.durationMs ?? 0,
        state: state.state,
        anchorPositionMs: state.anchorPositionMs,
        anchorServerTime: new Date(state.anchorServerTimeMs),
        playbackRate: state.playbackRate,
        volume: state.volume,
        updatedByDeviceId: state.updatedByDeviceId,
      },
    });
  }

  private fromPersisted(
    roomCode: string,
    row: {
      trackId: string | null;
      mediaType: string | null;
      title: string | null;
      subtitle: string | null;
      artworkUrl: string | null;
      sourceUrl: string | null;
      durationMs: number;
      state: string;
      anchorPositionMs: number;
      anchorServerTime: Date;
      playbackRate: number;
      volume: number;
      updatedByDeviceId: string | null;
      updatedAt: Date;
    },
  ): MediaSyncState {
    return {
      roomCode,
      track: row.trackId
        ? {
            id: row.trackId,
            mediaType: (row.mediaType as TrackInfo['mediaType']) ?? 'music',
            title: row.title ?? 'Untitled',
            subtitle: row.subtitle ?? undefined,
            artworkUrl: row.artworkUrl ?? undefined,
            sourceUrl: row.sourceUrl ?? '',
            durationMs: row.durationMs,
          }
        : null,
      queue: [],
      state: row.state as PlaybackState,
      anchorPositionMs: row.anchorPositionMs,
      anchorServerTimeMs: row.anchorServerTime.getTime(),
      playbackRate: row.playbackRate,
      volume: row.volume,
      updatedByDeviceId: row.updatedByDeviceId,
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
