import { SyncService } from './sync.service';
import { MediaSyncState } from '@orbit/shared';

describe('SyncService.livePositionMs', () => {
  const service = Object.create(SyncService.prototype) as SyncService;

  function state(overrides: Partial<MediaSyncState>): MediaSyncState {
    return {
      roomCode: 'ABC123',
      track: null,
      queue: [],
      state: 'paused',
      anchorPositionMs: 0,
      anchorServerTimeMs: 0,
      playbackRate: 1,
      volume: 1,
      updatedByDeviceId: null,
      updatedAt: new Date().toISOString(),
      ...overrides,
    };
  }

  it('returns the anchor position unchanged while paused', () => {
    const s = state({ state: 'paused', anchorPositionMs: 42_000 });
    expect(service.livePositionMs(s, 999_999)).toBe(42_000);
  });

  it('advances position by elapsed time while playing at 1x', () => {
    const s = state({ state: 'playing', anchorPositionMs: 10_000, anchorServerTimeMs: 1_000, playbackRate: 1 });
    expect(service.livePositionMs(s, 1_000 + 5_000)).toBe(15_000);
  });

  it('scales elapsed time by the playback rate', () => {
    const s = state({ state: 'playing', anchorPositionMs: 0, anchorServerTimeMs: 0, playbackRate: 2 });
    expect(service.livePositionMs(s, 3_000)).toBe(6_000);
  });

  it('never returns a negative position', () => {
    const s = state({ state: 'playing', anchorPositionMs: 0, anchorServerTimeMs: 10_000, playbackRate: 1 });
    // "now" before the anchor time (clock skew edge case) must clamp to 0.
    expect(service.livePositionMs(s, 5_000)).toBe(0);
  });
});
