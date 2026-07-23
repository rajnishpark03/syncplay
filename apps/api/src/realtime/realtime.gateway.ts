import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import {
  ClientEvents,
  DeviceHeartbeatPayload,
  MediaChangeTrackPayload,
  MediaEndedPayload,
  MediaPausePayload,
  MediaPlayPayload,
  MediaSeekPayload,
  MediaSpeedChangePayload,
  MediaVolumeChangePayload,
  QueueAddPayload,
  QueueRemovePayload,
  QueueSkipPayload,
  RoomJoinPayload,
  ScreenSignalPayload,
  ScreenStartPayload,
  ScreenStopPayload,
  ServerEvents,
  SOCKET_ROOM_PREFIX,
  SyncPingPayload,
  VoiceJoinPayload,
  VoiceMuteChangePayload,
  VoiceSignalPayload,
} from '@syncplay/shared';
import { WsAuthService, AuthenticatedSocket } from '../auth/guards/ws-jwt.guard';
import { SyncService } from '../sync/sync.service';
import { VoiceService } from '../voice/voice.service';
import { DevicesService } from '../devices/devices.service';
import { ActivityService } from '../activity/activity.service';
import { RoomsService } from '../rooms/rooms.service';
import { RoomPresenceService } from '../rooms/room-presence.service';

@WebSocketGateway({ cors: { origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000', credentials: true } })
export class RealtimeGateway {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly wsAuth: WsAuthService,
    private readonly syncService: SyncService,
    private readonly voiceService: VoiceService,
    private readonly devicesService: DevicesService,
    private readonly activityService: ActivityService,
    private readonly roomsService: RoomsService,
    private readonly roomPresence: RoomPresenceService,
  ) {}

  private channel(roomCode: string) {
    return `${SOCKET_ROOM_PREFIX}${roomCode}`;
  }

  async handleConnection(client: Socket) {
    const authed = this.wsAuth.authenticate(client);
    if (!authed) {
      client.emit(ServerEvents.ERROR, { code: 'UNAUTHENTICATED', message: 'Invalid or missing token' });
      client.disconnect(true);
      return;
    }

    const device = await this.devicesService.findById(authed.data.deviceId);
    authed.data.deviceName = device?.name;
    await this.devicesService.markOnline(authed.data.deviceId, client.id);

    this.logger.log(`Device ${authed.data.deviceId} connected (${authed.data.email})`);
  }

  async handleDisconnect(client: Socket) {
    const data = (client as AuthenticatedSocket).data;
    if (!data) return;

    await this.devicesService.markOffline(data.deviceId);

    if (data.roomCode) {
      await this.leaveRoom(client as AuthenticatedSocket, data.roomCode, 'disconnected');
    }

    this.logger.log(`Device ${data.deviceId} disconnected`);
  }

  // ---- Room membership ----

  @SubscribeMessage(ClientEvents.ROOM_JOIN)
  async onRoomJoin(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() payload: RoomJoinPayload) {
    const roomCode = payload.roomCode.toUpperCase();

    let room;
    try {
      room = await this.roomsService.findByCode(roomCode);
    } catch {
      client.emit(ServerEvents.ERROR, { code: 'ROOM_NOT_FOUND', message: 'That room code does not exist' });
      return;
    }

    if (client.data.roomCode && client.data.roomCode !== roomCode) {
      await this.leaveRoom(client, client.data.roomCode, 'switched room');
    }

    client.data.roomCode = roomCode;
    await client.join(this.channel(roomCode));
    await this.roomPresence.join(roomCode, client.data.deviceId);

    const members = await this.roomPresence.members(roomCode);
    const state = await this.syncService.getState(roomCode);

    client.emit(ServerEvents.ROOM_JOINED, { room, members });
    client.emit(ServerEvents.MEDIA_STATE, state);

    client.to(this.channel(roomCode)).emit(ServerEvents.ROOM_MEMBER_JOINED, {
      deviceId: client.data.deviceId,
      deviceName: client.data.deviceName ?? 'Device',
      platform: (await this.devicesService.findById(client.data.deviceId))?.platform ?? 'web',
      userId: client.data.userId,
      isHost: client.data.userId === room.hostUserId,
    });

    const activity = await this.activityService.record(
      client.data.userId,
      client.data.deviceId,
      'device_connected',
      `${client.data.deviceName ?? 'A device'} joined the room`,
      roomCode,
    );
    this.server.to(this.channel(roomCode)).emit(ServerEvents.ACTIVITY_NEW, activity);
  }

  @SubscribeMessage(ClientEvents.ROOM_LEAVE)
  async onRoomLeave(@ConnectedSocket() client: AuthenticatedSocket) {
    if (!client.data.roomCode) return;
    await this.leaveRoom(client, client.data.roomCode, 'left');
    client.data.roomCode = undefined;
  }

  private async leaveRoom(client: AuthenticatedSocket, roomCode: string, reason: 'left' | 'disconnected' | 'switched room') {
    client.leave(this.channel(roomCode));
    await this.roomPresence.leave(roomCode, client.data.deviceId);
    await this.voiceService.leave(roomCode, client.data.deviceId);

    client.to(this.channel(roomCode)).emit(ServerEvents.ROOM_MEMBER_LEFT, { deviceId: client.data.deviceId });
    client.to(this.channel(roomCode)).emit(ServerEvents.VOICE_PEER_LEFT, { deviceId: client.data.deviceId });

    const activity = await this.activityService.record(
      client.data.userId,
      client.data.deviceId,
      'device_disconnected',
      `${client.data.deviceName ?? 'A device'} ${reason === 'disconnected' ? 'went offline' : 'left the room'}`,
      roomCode,
    );
    this.server.to(this.channel(roomCode)).emit(ServerEvents.ACTIVITY_NEW, activity);
  }

  // ---- Device presence (account-level, independent of room) ----

  @SubscribeMessage(ClientEvents.DEVICE_HEARTBEAT)
  async onHeartbeat(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() payload: DeviceHeartbeatPayload) {
    await this.devicesService.heartbeat(client.data.deviceId, payload);
  }

  // ---- Playback sync (room-scoped) ----

  @SubscribeMessage(ClientEvents.MEDIA_PLAY)
  async onPlay(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() payload: MediaPlayPayload) {
    if (!this.requireRoom(client)) return;
    const state = await this.syncService.play(client.data.roomCode!, client.data.deviceId, payload.positionMs);
    this.broadcastState(client.data.roomCode!, state);
    this.logActivity(client, 'media_play', 'Started playback');
  }

  @SubscribeMessage(ClientEvents.MEDIA_PAUSE)
  async onPause(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() payload: MediaPausePayload) {
    if (!this.requireRoom(client)) return;
    const state = await this.syncService.pause(client.data.roomCode!, client.data.deviceId, payload.positionMs);
    this.broadcastState(client.data.roomCode!, state);
    this.logActivity(client, 'media_pause', 'Paused playback');
  }

  @SubscribeMessage(ClientEvents.MEDIA_SEEK)
  async onSeek(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() payload: MediaSeekPayload) {
    if (!this.requireRoom(client)) return;
    const state = await this.syncService.seek(client.data.roomCode!, client.data.deviceId, payload.positionMs);
    this.broadcastState(client.data.roomCode!, state);
    this.logActivity(client, 'media_seek', 'Seeked to a new position');
  }

  @SubscribeMessage(ClientEvents.MEDIA_CHANGE_TRACK)
  async onChangeTrack(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() payload: MediaChangeTrackPayload) {
    if (!this.requireRoom(client)) return;
    const state = await this.syncService.changeTrack(
      client.data.roomCode!,
      client.data.deviceId,
      payload.track,
      payload.positionMs,
      payload.autoplay,
    );
    this.broadcastState(client.data.roomCode!, state);
    this.logActivity(client, 'media_track_changed', `Now playing "${payload.track.title}"`);
  }

  @SubscribeMessage(ClientEvents.MEDIA_SPEED_CHANGE)
  async onSpeedChange(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() payload: MediaSpeedChangePayload) {
    if (!this.requireRoom(client)) return;
    const current = await this.syncService.getState(client.data.roomCode!);
    const positionMs = this.syncService.livePositionMs(current);
    const state = await this.syncService.changeSpeed(client.data.roomCode!, client.data.deviceId, payload.rate, positionMs);
    this.broadcastState(client.data.roomCode!, state);
  }

  @SubscribeMessage(ClientEvents.MEDIA_VOLUME_CHANGE)
  async onVolumeChange(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() payload: MediaVolumeChangePayload) {
    if (!this.requireRoom(client)) return;
    const state = await this.syncService.changeVolume(client.data.roomCode!, client.data.deviceId, payload.volume);
    this.broadcastState(client.data.roomCode!, state);
  }

  @SubscribeMessage(ClientEvents.QUEUE_ADD)
  async onQueueAdd(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() payload: QueueAddPayload) {
    if (!this.requireRoom(client)) return;
    const state = await this.syncService.addToQueue(client.data.roomCode!, payload.track);
    this.broadcastState(client.data.roomCode!, state);
    this.logActivity(client, 'media_track_changed', `Added "${payload.track.title}" to the queue`);
  }

  @SubscribeMessage(ClientEvents.QUEUE_REMOVE)
  async onQueueRemove(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() payload: QueueRemovePayload) {
    if (!this.requireRoom(client)) return;
    const state = await this.syncService.removeFromQueue(client.data.roomCode!, payload.trackId);
    this.broadcastState(client.data.roomCode!, state);
  }

  @SubscribeMessage(ClientEvents.QUEUE_SKIP)
  async onQueueSkip(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() _payload: QueueSkipPayload) {
    if (!this.requireRoom(client)) return;
    const state = await this.syncService.advance(client.data.roomCode!, client.data.deviceId);
    this.broadcastState(client.data.roomCode!, state);
    if (state.track) this.logActivity(client, 'media_track_changed', `Skipped to "${state.track.title}"`);
  }

  // A client reports its player fired "ended". Multiple devices in the same
  // room can report the same track independently — claimEnded() makes sure
  // only the first report actually advances the queue.
  @SubscribeMessage(ClientEvents.MEDIA_ENDED)
  async onMediaEnded(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() payload: MediaEndedPayload) {
    if (!this.requireRoom(client)) return;
    const roomCode = client.data.roomCode!;
    const wonClaim = await this.syncService.claimEnded(roomCode, payload.trackId);
    if (!wonClaim) return;

    const state = await this.syncService.advance(roomCode, client.data.deviceId);
    this.broadcastState(roomCode, state);
    if (state.track) this.logActivity(client, 'media_track_changed', `Now playing "${state.track.title}"`);
  }

  @SubscribeMessage(ClientEvents.SYNC_REQUEST_STATE)
  async onRequestState(@ConnectedSocket() client: AuthenticatedSocket) {
    if (!this.requireRoom(client)) return;
    const state = await this.syncService.getState(client.data.roomCode!);
    client.emit(ServerEvents.MEDIA_STATE, state);
  }

  // Clock-offset / RTT measurement, used client-side for the sub-100ms drift
  // correction loop (see docs/SOCKET_EVENTS.md). Works even outside a room.
  @SubscribeMessage(ClientEvents.SYNC_PING)
  onPing(@ConnectedSocket() client: Socket, @MessageBody() payload: SyncPingPayload) {
    client.emit(ServerEvents.SYNC_PONG, {
      clientTimestamp: payload.clientTimestamp,
      serverTimestamp: Date.now(),
    });
  }

  // ---- Voice chat signaling (room-scoped; WebRTC relay only — no media touches the server) ----

  @SubscribeMessage(ClientEvents.VOICE_JOIN)
  async onVoiceJoin(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() _payload: VoiceJoinPayload) {
    if (!this.requireRoom(client)) return;
    const roomCode = client.data.roomCode!;
    const participants = await this.voiceService.join(roomCode, client.data.deviceId);

    client.to(this.channel(roomCode)).emit(ServerEvents.VOICE_PEER_JOINED, {
      deviceId: client.data.deviceId,
      deviceName: client.data.deviceName ?? 'Device',
    });

    client.emit(ServerEvents.VOICE_PARTICIPANTS, participants.filter((id) => id !== client.data.deviceId));

    const activity = await this.activityService.record(
      client.data.userId,
      client.data.deviceId,
      'voice_started',
      `${client.data.deviceName ?? 'A device'} joined voice chat`,
      roomCode,
    );
    this.server.to(this.channel(roomCode)).emit(ServerEvents.ACTIVITY_NEW, activity);
  }

  @SubscribeMessage(ClientEvents.VOICE_LEAVE)
  async onVoiceLeave(@ConnectedSocket() client: AuthenticatedSocket) {
    if (!client.data.roomCode) return;
    await this.voiceService.leave(client.data.roomCode, client.data.deviceId);
    client.to(this.channel(client.data.roomCode)).emit(ServerEvents.VOICE_PEER_LEFT, { deviceId: client.data.deviceId });
  }

  @SubscribeMessage(ClientEvents.VOICE_SIGNAL)
  onVoiceSignal(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() payload: VoiceSignalPayload) {
    if (!this.requireRoom(client)) return;
    this.server.to(this.channel(client.data.roomCode!)).except(client.id).emit(ServerEvents.VOICE_SIGNAL, {
      fromDeviceId: client.data.deviceId,
      signal: payload.signal,
      targetDeviceId: payload.targetDeviceId,
    });
  }

  @SubscribeMessage(ClientEvents.VOICE_MUTE_CHANGE)
  onVoiceMuteChange(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() payload: VoiceMuteChangePayload) {
    if (!client.data.roomCode) return;
    client.to(this.channel(client.data.roomCode)).emit(ServerEvents.VOICE_PEER_MUTE_CHANGE, {
      deviceId: client.data.deviceId,
      muted: payload.muted,
    });
  }

  // ---- Screen share signaling (room-scoped; relay only, same pattern as voice) ----

  @SubscribeMessage(ClientEvents.SCREEN_START)
  async onScreenStart(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() _payload: ScreenStartPayload) {
    if (!this.requireRoom(client)) return;
    const roomCode = client.data.roomCode!;
    client.to(this.channel(roomCode)).emit(ServerEvents.SCREEN_PEER_STARTED, {
      deviceId: client.data.deviceId,
      deviceName: client.data.deviceName ?? 'Device',
    });
    this.logActivity(client, 'screen_share_started', `${client.data.deviceName ?? 'A device'} started sharing their screen`);
  }

  @SubscribeMessage(ClientEvents.SCREEN_STOP)
  async onScreenStop(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() _payload: ScreenStopPayload) {
    if (!client.data.roomCode) return;
    client.to(this.channel(client.data.roomCode)).emit(ServerEvents.SCREEN_PEER_STOPPED, { deviceId: client.data.deviceId });
    this.logActivity(client, 'screen_share_stopped', `${client.data.deviceName ?? 'A device'} stopped sharing their screen`);
  }

  @SubscribeMessage(ClientEvents.SCREEN_SIGNAL)
  onScreenSignal(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() payload: ScreenSignalPayload) {
    if (!this.requireRoom(client)) return;
    this.server.to(this.channel(client.data.roomCode!)).except(client.id).emit(ServerEvents.SCREEN_SIGNAL, {
      fromDeviceId: client.data.deviceId,
      signal: payload.signal,
      targetDeviceId: payload.targetDeviceId,
    });
  }

  private requireRoom(client: AuthenticatedSocket): boolean {
    if (client.data.roomCode) return true;
    client.emit(ServerEvents.ERROR, { code: 'NOT_IN_ROOM', message: 'Join a room before controlling playback' });
    return false;
  }

  private broadcastState(roomCode: string, state: Awaited<ReturnType<SyncService['getState']>>) {
    this.server.to(this.channel(roomCode)).emit(ServerEvents.MEDIA_STATE, state);
  }

  private logActivity(client: AuthenticatedSocket, type: Parameters<ActivityService['record']>[2], message: string) {
    const roomCode = client.data.roomCode!;
    this.activityService.record(client.data.userId, client.data.deviceId, type, message, roomCode).then((activity) => {
      this.server.to(this.channel(roomCode)).emit(ServerEvents.ACTIVITY_NEW, activity);
    });
  }
}
