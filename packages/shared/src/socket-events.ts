import { ActivityEntry, DeviceInfo, MediaSyncState, PlaybackState, RoomInfo, RoomMember, TrackInfo } from './domain';

/**
 * Single Socket.IO connection per device, authenticated via JWT in the
 * handshake. Connecting does NOT put a device into any playback/voice room
 * by itself — a device must explicitly `room:join` a room code (created via
 * `POST /rooms` or obtained from whoever hosted it) before it receives any
 * sync/voice traffic. That's what lets two *different* accounts share a
 * session: the room, not the login email, is the unit of sync.
 */
export const SOCKET_ROOM_PREFIX = 'room:';

export const ClientEvents = {
  DEVICE_HEARTBEAT: 'device:heartbeat',
  ROOM_JOIN: 'room:join',
  ROOM_LEAVE: 'room:leave',
  MEDIA_PLAY: 'media:play',
  MEDIA_PAUSE: 'media:pause',
  MEDIA_SEEK: 'media:seek',
  MEDIA_CHANGE_TRACK: 'media:changeTrack',
  MEDIA_SPEED_CHANGE: 'media:speedChange',
  MEDIA_VOLUME_CHANGE: 'media:volumeChange',
  MEDIA_ENDED: 'media:ended',
  QUEUE_ADD: 'queue:add',
  QUEUE_REMOVE: 'queue:remove',
  QUEUE_SKIP: 'queue:skip',
  QUEUE_PLAY: 'queue:play',
  SYNC_PING: 'sync:ping',
  SYNC_REQUEST_STATE: 'sync:requestState',
  VOICE_JOIN: 'voice:join',
  VOICE_LEAVE: 'voice:leave',
  VOICE_SIGNAL: 'voice:signal',
  VOICE_MUTE_CHANGE: 'voice:muteChange',
  SCREEN_START: 'screen:start',
  SCREEN_STOP: 'screen:stop',
  SCREEN_SIGNAL: 'screen:signal',
  GAME_START: 'game:start',
  GAME_MOVE: 'game:move',
  GAME_END: 'game:end',
  GAME_REQUEST_STATE: 'game:requestState',
} as const;

export const ServerEvents = {
  ROOM_JOINED: 'room:joined',
  ROOM_MEMBER_JOINED: 'room:member-joined',
  ROOM_MEMBER_LEFT: 'room:member-left',
  MEDIA_STATE: 'media:state',
  SYNC_PONG: 'sync:pong',
  ACTIVITY_NEW: 'activity:new',
  VOICE_PEER_JOINED: 'voice:peer-joined',
  VOICE_PEER_LEFT: 'voice:peer-left',
  VOICE_PARTICIPANTS: 'voice:participants',
  VOICE_SIGNAL: 'voice:signal',
  VOICE_PEER_MUTE_CHANGE: 'voice:peer-muteChange',
  SCREEN_PEER_STARTED: 'screen:peer-started',
  SCREEN_PEER_STOPPED: 'screen:peer-stopped',
  SCREEN_SIGNAL: 'screen:signal',
  GAME_STATE: 'game:state',
  ERROR: 'error',
} as const;

// ---- Client -> Server payloads ----

export interface DeviceHeartbeatPayload {
  deviceId: string;
  batteryLevel?: number | null;
  networkQuality?: DeviceInfo['networkQuality'];
}

export interface RoomJoinPayload {
  deviceId: string;
  roomCode: string;
}

export interface MediaPlayPayload {
  deviceId: string;
  positionMs: number;
  clientTimestamp: number;
}

export interface MediaPausePayload {
  deviceId: string;
  positionMs: number;
  clientTimestamp: number;
}

export interface MediaSeekPayload {
  deviceId: string;
  positionMs: number;
  clientTimestamp: number;
}

export interface MediaChangeTrackPayload {
  deviceId: string;
  track: TrackInfo;
  positionMs: number;
  autoplay: boolean;
  clientTimestamp: number;
}

export interface MediaSpeedChangePayload {
  deviceId: string;
  rate: number;
  clientTimestamp: number;
}

export interface MediaVolumeChangePayload {
  deviceId: string;
  volume: number;
}

export interface SyncPingPayload {
  deviceId: string;
  clientTimestamp: number;
}

export interface VoiceJoinPayload {
  deviceId: string;
}

export interface VoiceSignalPayload {
  deviceId: string;
  targetDeviceId: string;
  signal: unknown; // RTCSessionDescriptionInit | RTCIceCandidateInit
}

export interface VoiceMuteChangePayload {
  deviceId: string;
  muted: boolean;
}

export interface MediaEndedPayload {
  deviceId: string;
  trackId: string;
}

export interface QueueAddPayload {
  deviceId: string;
  track: TrackInfo;
}

export interface QueueRemovePayload {
  deviceId: string;
  trackId: string;
}

export interface QueueSkipPayload {
  deviceId: string;
}

export interface QueuePlayPayload {
  deviceId: string;
  trackId: string;
}

export interface ScreenStartPayload {
  deviceId: string;
}

export interface ScreenStopPayload {
  deviceId: string;
}

export interface ScreenSignalPayload {
  deviceId: string;
  targetDeviceId: string;
  signal: unknown;
}

// ---- Server -> Client payloads ----

export interface RoomJoinedPayload {
  room: RoomInfo;
  members: RoomMember[];
}

export interface SyncPongPayload {
  clientTimestamp: number;
  serverTimestamp: number;
}

export interface VoicePeerJoinedPayload {
  deviceId: string;
  deviceName: string;
}

export interface VoiceSignalRelayPayload {
  fromDeviceId: string;
  targetDeviceId?: string;
  signal: unknown;
}

export interface ScreenPeerStartedPayload {
  deviceId: string;
  deviceName: string;
}

export interface ScreenSignalRelayPayload {
  fromDeviceId: string;
  targetDeviceId?: string;
  signal: unknown;
}

export interface ServerErrorPayload {
  code: string;
  message: string;
}

export type { MediaSyncState, PlaybackState, ActivityEntry, DeviceInfo, TrackInfo, RoomInfo, RoomMember };
