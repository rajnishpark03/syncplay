export type Platform = 'ios' | 'android' | 'web' | 'desktop';

export type NetworkQuality = 'excellent' | 'good' | 'fair' | 'poor' | 'unknown';

export type PlaybackState = 'idle' | 'playing' | 'paused' | 'buffering';

export type MediaType = 'music' | 'video' | 'movie';

export interface DeviceInfo {
  id: string;
  userId: string;
  name: string;
  platform: Platform;
  appVersion?: string;
  isOnline: boolean;
  networkQuality: NetworkQuality;
  pingMs: number | null;
  batteryLevel: number | null;
  lastSeenAt: string; // ISO timestamp
  createdAt: string;
}

/**
 * A shareable watch/listen party. Created by a "host" account; anyone with
 * the `code` can join from their own device/account — rooms are not tied to
 * a single email the way account-level device presence is.
 */
export interface RoomInfo {
  code: string;
  hostUserId: string;
  hostName: string;
  name: string | null;
  createdAt: string;
}

/** A device currently connected inside a specific room (room-scoped presence). */
export interface RoomMember {
  deviceId: string;
  deviceName: string;
  platform: Platform;
  userId: string;
  isHost: boolean;
}

/**
 * `provider` selects how the client plays `sourceUrl`:
 *  - 'direct'  — a plain media URL played through <video>/<audio> (self-hosted or licensed)
 *  - 'youtube' — sourceUrl is a YouTube video ID, played via YouTube's official IFrame Player API
 *                (https://developers.google.com/youtube/iframe_api_reference). No DRM bypass —
 *                this is Google's own supported embedding mechanism.
 */
export type MediaProvider = 'direct' | 'youtube';

export interface TrackInfo {
  id: string;
  mediaType: MediaType;
  title: string;
  subtitle?: string; // artist / show name
  artworkUrl?: string;
  sourceUrl: string; // playable URL (direct) or video ID (youtube)
  durationMs: number;
  provider?: MediaProvider; // defaults to 'direct' when absent
}

/**
 * Server-authoritative playback anchor. Clients derive the live position as:
 *   positionMs = anchorPositionMs + (nowMs - anchorServerTimeMs) * playbackRate   (while playing)
 *   positionMs = anchorPositionMs                                                 (while paused)
 * This avoids drifting client-side timers and lets every client reconstruct the
 * exact same position independent of when its last message arrived.
 */
export interface MediaSyncState {
  roomCode: string;
  track: TrackInfo | null;
  /** Up-next tracks, in play order. Advancing pops the front entry into `track`. */
  queue: TrackInfo[];
  state: PlaybackState;
  anchorPositionMs: number;
  anchorServerTimeMs: number;
  playbackRate: number;
  volume: number;
  updatedByDeviceId: string | null;
  updatedAt: string;
}

export type ActivityType =
  | 'device_connected'
  | 'device_disconnected'
  | 'media_play'
  | 'media_pause'
  | 'media_seek'
  | 'media_track_changed'
  | 'voice_started'
  | 'voice_ended'
  | 'screen_share_started'
  | 'screen_share_stopped'
  | 'game_started'
  | 'game_ended';

export interface ActivityEntry {
  id: string;
  userId: string;
  deviceId: string | null;
  deviceName?: string;
  roomCode?: string | null;
  type: ActivityType;
  message: string;
  createdAt: string;
}

export interface SyncHealth {
  latencyMs: number;
  clockOffsetMs: number;
  driftMs: number;
  quality: NetworkQuality;
  lastMeasuredAt: string;
}
