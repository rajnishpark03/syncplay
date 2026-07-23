'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ClientEvents,
  DeviceInfo,
  MediaSyncState,
  RoomJoinedPayload,
  RoomMember,
  ServerEvents,
  ServerErrorPayload,
  SyncPongPayload,
  SyncHealth,
  TrackInfo,
} from '@syncplay/shared';
import { getSocket } from '@/lib/socket';
import { getOrCreateDeviceId } from '@/lib/device';
import { useRoomStore } from '@/lib/room-store';

const PING_INTERVAL_MS = 4000;
const IDLE_STATE: MediaSyncState = {
  roomCode: '',
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

function qualityFromLatency(latencyMs: number): SyncHealth['quality'] {
  if (latencyMs <= 40) return 'excellent';
  if (latencyMs <= 100) return 'good';
  if (latencyMs <= 250) return 'fair';
  return 'poor';
}

export function useSyncEngine() {
  const currentRoom = useRoomStore((s) => s.currentRoom);
  const clearRoom = useRoomStore((s) => s.clearRoom);

  const [mediaState, setMediaState] = useState<MediaSyncState>(IDLE_STATE);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [connected, setConnected] = useState(false);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [syncHealth, setSyncHealth] = useState<SyncHealth>({
    latencyMs: 0,
    clockOffsetMs: 0,
    driftMs: 0,
    quality: 'unknown',
    lastMeasuredAt: new Date(0).toISOString(),
  });
  const clockOffsetRef = useRef(0);
  const deviceId = useRef(getOrCreateDeviceId());

  const joinCurrentRoom = useCallback(() => {
    const socket = getSocket();
    if (socket.connected && currentRoom) {
      setRoomError(null);
      socket.emit(ClientEvents.ROOM_JOIN, { deviceId: deviceId.current, roomCode: currentRoom.code });
    }
  }, [currentRoom]);

  useEffect(() => {
    const socket = getSocket();

    const onConnect = () => {
      setConnected(true);
      joinCurrentRoom();
    };
    const onDisconnect = () => setConnected(false);
    // Normalize: older cached room state (from before the queue feature) may
    // arrive without a `queue` array — guarantee it's always present so the UI
    // can rely on mediaState.queue.length without a crash.
    const onMediaState = (state: MediaSyncState) =>
      setMediaState({ ...state, queue: state.queue ?? [] });
    const onRoomJoined = (payload: RoomJoinedPayload) => {
      setMembers(payload.members);
      setRoomError(null);
    };
    const onMemberJoined = (member: RoomMember) =>
      setMembers((prev) => [...prev.filter((m) => m.deviceId !== member.deviceId), member]);
    const onMemberLeft = ({ deviceId: id }: { deviceId: string }) =>
      setMembers((prev) => prev.filter((m) => m.deviceId !== id));
    const onPong = (payload: SyncPongPayload) => {
      const now = Date.now();
      const rtt = now - payload.clientTimestamp;
      const offset = payload.serverTimestamp - (payload.clientTimestamp + rtt / 2);
      clockOffsetRef.current = offset;
      const latencyMs = Math.round(rtt / 2);
      setSyncHealth({
        latencyMs,
        clockOffsetMs: Math.round(offset),
        driftMs: 0,
        quality: qualityFromLatency(latencyMs),
        lastMeasuredAt: new Date().toISOString(),
      });
    };
    const onError = (err: ServerErrorPayload) => {
      if (err.code === 'ROOM_NOT_FOUND') {
        setRoomError(err.message);
        clearRoom();
        setMembers([]);
      }
      // eslint-disable-next-line no-console
      console.warn('[sync] server error', err);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on(ServerEvents.MEDIA_STATE, onMediaState);
    socket.on(ServerEvents.ROOM_JOINED, onRoomJoined);
    socket.on(ServerEvents.ROOM_MEMBER_JOINED, onMemberJoined);
    socket.on(ServerEvents.ROOM_MEMBER_LEFT, onMemberLeft);
    socket.on(ServerEvents.SYNC_PONG, onPong);
    socket.on(ServerEvents.ERROR, onError);

    if (socket.connected) {
      setConnected(true);
      joinCurrentRoom();
    }

    const pingTimer = setInterval(() => {
      if (socket.connected) {
        socket.emit(ClientEvents.SYNC_PING, { deviceId: deviceId.current, clientTimestamp: Date.now() });
      }
    }, PING_INTERVAL_MS);
    if (socket.connected) socket.emit(ClientEvents.SYNC_PING, { deviceId: deviceId.current, clientTimestamp: Date.now() });

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off(ServerEvents.MEDIA_STATE, onMediaState);
      socket.off(ServerEvents.ROOM_JOINED, onRoomJoined);
      socket.off(ServerEvents.ROOM_MEMBER_JOINED, onMemberJoined);
      socket.off(ServerEvents.ROOM_MEMBER_LEFT, onMemberLeft);
      socket.off(ServerEvents.SYNC_PONG, onPong);
      socket.off(ServerEvents.ERROR, onError);
      clearInterval(pingTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRoom?.code]);

  /** Server-anchored expected position right now, in the local clock frame. */
  const expectedPositionMs = useCallback(
    (state: MediaSyncState = mediaState, atMs = Date.now()) => {
      if (state.state !== 'playing') return state.anchorPositionMs;
      const serverNow = atMs + clockOffsetRef.current;
      const elapsed = (serverNow - state.anchorServerTimeMs) * state.playbackRate;
      return Math.max(0, state.anchorPositionMs + elapsed);
    },
    [mediaState],
  );

  const play = useCallback((positionMs: number) => {
    getSocket().emit(ClientEvents.MEDIA_PLAY, { deviceId: deviceId.current, positionMs, clientTimestamp: Date.now() });
  }, []);

  const pause = useCallback((positionMs: number) => {
    getSocket().emit(ClientEvents.MEDIA_PAUSE, { deviceId: deviceId.current, positionMs, clientTimestamp: Date.now() });
  }, []);

  const seek = useCallback((positionMs: number) => {
    getSocket().emit(ClientEvents.MEDIA_SEEK, { deviceId: deviceId.current, positionMs, clientTimestamp: Date.now() });
  }, []);

  const changeTrack = useCallback((track: TrackInfo, positionMs = 0, autoplay = true) => {
    getSocket().emit(ClientEvents.MEDIA_CHANGE_TRACK, {
      deviceId: deviceId.current,
      track,
      positionMs,
      autoplay,
      clientTimestamp: Date.now(),
    });
  }, []);

  const changeSpeed = useCallback((rate: number) => {
    getSocket().emit(ClientEvents.MEDIA_SPEED_CHANGE, { deviceId: deviceId.current, rate, clientTimestamp: Date.now() });
  }, []);

  const changeVolume = useCallback((volume: number) => {
    getSocket().emit(ClientEvents.MEDIA_VOLUME_CHANGE, { deviceId: deviceId.current, volume });
  }, []);

  const requestState = useCallback(() => {
    getSocket().emit(ClientEvents.SYNC_REQUEST_STATE);
  }, []);

  const addToQueue = useCallback((track: TrackInfo) => {
    getSocket().emit(ClientEvents.QUEUE_ADD, { deviceId: deviceId.current, track });
  }, []);

  const removeFromQueue = useCallback((trackId: string) => {
    getSocket().emit(ClientEvents.QUEUE_REMOVE, { deviceId: deviceId.current, trackId });
  }, []);

  const skip = useCallback(() => {
    getSocket().emit(ClientEvents.QUEUE_SKIP, { deviceId: deviceId.current });
  }, []);

  const reportEnded = useCallback((trackId: string) => {
    getSocket().emit(ClientEvents.MEDIA_ENDED, { deviceId: deviceId.current, trackId });
  }, []);

  const heartbeat = useCallback((data: { batteryLevel?: number | null; networkQuality?: DeviceInfo['networkQuality'] }) => {
    getSocket().emit(ClientEvents.DEVICE_HEARTBEAT, { deviceId: deviceId.current, ...data });
  }, []);

  const leaveRoom = useCallback(() => {
    getSocket().emit(ClientEvents.ROOM_LEAVE);
    clearRoom();
    setMembers([]);
    setMediaState(IDLE_STATE);
  }, [clearRoom]);

  return {
    connected,
    deviceId: deviceId.current,
    roomCode: currentRoom?.code ?? null,
    roomError,
    mediaState,
    members,
    syncHealth,
    expectedPositionMs,
    play,
    pause,
    seek,
    changeTrack,
    changeSpeed,
    changeVolume,
    requestState,
    addToQueue,
    removeFromQueue,
    skip,
    reportEnded,
    heartbeat,
    leaveRoom,
  };
}
