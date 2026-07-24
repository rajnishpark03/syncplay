'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ClientEvents, ServerEvents, VoicePeerJoinedPayload, VoiceSignalRelayPayload } from '@orbit/shared';
import { getSocket } from '@/lib/socket';
import { getOrCreateDeviceId } from '@/lib/device';
import { createRingtone } from '@/lib/ringtone';

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

type Signal = { kind: 'offer' | 'answer'; sdp: RTCSessionDescriptionInit } | { kind: 'ice'; candidate: RTCIceCandidateInit };

export type VoiceStatus = 'idle' | 'connecting' | 'connected' | 'error';

/** Per-peer state for the "perfect negotiation" pattern (handles renegotiation
 * when the camera is toggled on/off mid-call, including simultaneous offers). */
interface PeerState {
  pc: RTCPeerConnection;
  makingOffer: boolean;
  ignoreOffer: boolean;
  /** The "polite" side yields on an offer collision; decided deterministically by id. */
  polite: boolean;
}

export function useVoiceChat() {
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [muted, setMuted] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(false);
  const [remoteLevel, setRemoteLevel] = useState(0);
  const [peerDeviceIds, setPeerDeviceIds] = useState<string[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  /** Someone in the room started voice while we're idle → ring them through. */
  const [incomingCall, setIncomingCall] = useState<{ deviceId: string; deviceName: string } | null>(null);

  const deviceId = useRef(getOrCreateDeviceId());
  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, PeerState>>(new Map());
  const remoteAudioElsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const analyserRef = useRef<{ ctx: AudioContext; frame: number } | null>(null);
  const ringtoneRef = useRef<ReturnType<typeof createRingtone> | null>(null);
  const statusRef = useRef(status);
  statusRef.current = status;

  const stopRinging = useCallback(() => {
    ringtoneRef.current?.stop();
    ringtoneRef.current = null;
    setIncomingCall(null);
  }, []);

  const emitSignal = (targetDeviceId: string, signal: Signal) => {
    getSocket().emit(ClientEvents.VOICE_SIGNAL, { deviceId: deviceId.current, targetDeviceId, signal });
  };

  const startLevelMeter = (stream: MediaStream) => {
    if (analyserRef.current || stream.getAudioTracks().length === 0) return;
    const ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((a, b) => a + b, 0) / data.length;
      setRemoteLevel(Math.min(1, avg / 128));
      analyserRef.current!.frame = requestAnimationFrame(tick);
    };
    analyserRef.current = { ctx, frame: requestAnimationFrame(tick) };
  };

  const stopLevelMeter = () => {
    if (analyserRef.current) {
      cancelAnimationFrame(analyserRef.current.frame);
      analyserRef.current.ctx.close();
      analyserRef.current = null;
    }
    setRemoteLevel(0);
  };

  const getOrCreatePeer = useCallback((peerId: string): PeerState => {
    const existing = peersRef.current.get(peerId);
    if (existing) return existing;

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const state: PeerState = { pc, makingOffer: false, ignoreOffer: false, polite: deviceId.current < peerId };

    localStreamRef.current?.getTracks().forEach((track) => pc.addTrack(track, localStreamRef.current!));

    pc.onicecandidate = (e) => {
      if (e.candidate) emitSignal(peerId, { kind: 'ice', candidate: e.candidate.toJSON() });
    };

    // Fires whenever tracks are added/removed (e.g. camera toggled) — this is
    // what makes turning the camera on mid-call actually reach the other side.
    pc.onnegotiationneeded = async () => {
      try {
        state.makingOffer = true;
        await pc.setLocalDescription();
        if (pc.localDescription) emitSignal(peerId, { kind: 'offer', sdp: pc.localDescription });
      } catch {
        // transient — the next negotiationneeded will retry
      } finally {
        state.makingOffer = false;
      }
    };

    pc.ontrack = (event) => {
      const stream = event.streams[0];
      if (!stream) return;

      // Audio plays through a dedicated element so it keeps working even when
      // no video tile is rendered; video tiles are muted to avoid double audio.
      if (event.track.kind === 'audio') {
        let audioEl = remoteAudioElsRef.current.get(peerId);
        if (!audioEl) {
          audioEl = new Audio();
          audioEl.autoplay = true;
          remoteAudioElsRef.current.set(peerId, audioEl);
        }
        audioEl.srcObject = stream;
        audioEl.muted = !speakerOn;
        audioEl.play().catch(() => undefined);
        startLevelMeter(stream);
      }

      setRemoteStreams((prev) => ({ ...prev, [peerId]: stream }));
      setStatus('connected');
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        setStatus((s) => (s === 'connected' ? 'connecting' : s));
      }
    };

    peersRef.current.set(peerId, state);
    return state;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const socket = getSocket();

    const onPeerJoined = (payload: VoicePeerJoinedPayload) => {
      setPeerDeviceIds((prev) => Array.from(new Set([...prev, payload.deviceId])));
      // Not in the call yet → this is an incoming call, so ring.
      if (statusRef.current === 'idle') {
        setIncomingCall({ deviceId: payload.deviceId, deviceName: payload.deviceName });
        if (!ringtoneRef.current) {
          ringtoneRef.current = createRingtone();
          ringtoneRef.current.start();
        }
      }
    };

    const onPeerLeft = ({ deviceId: peerId }: { deviceId: string }) => {
      peersRef.current.get(peerId)?.pc.close();
      peersRef.current.delete(peerId);
      remoteAudioElsRef.current.get(peerId)?.pause();
      remoteAudioElsRef.current.delete(peerId);
      setRemoteStreams((prev) => {
        const next = { ...prev };
        delete next[peerId];
        return next;
      });
      setPeerDeviceIds((prev) => prev.filter((id) => id !== peerId));
      setIncomingCall((cur) => (cur?.deviceId === peerId ? null : cur));
      if (peersRef.current.size === 0) stopLevelMeter();
      ringtoneRef.current?.stop();
      ringtoneRef.current = null;
    };

    // Peers already in the voice room when we joined — we initiate to them.
    const onParticipants = (existingPeerIds: string[]) => {
      setPeerDeviceIds(existingPeerIds);
      existingPeerIds.forEach((peerId) => getOrCreatePeer(peerId)); // negotiationneeded fires the offer
    };

    const onSignal = async ({ fromDeviceId, signal }: VoiceSignalRelayPayload & { targetDeviceId?: string }) => {
      const typed = signal as Signal;
      const state = getOrCreatePeer(fromDeviceId);
      const { pc } = state;

      try {
        if (typed.kind === 'offer' || typed.kind === 'answer') {
          const collision = typed.kind === 'offer' && (state.makingOffer || pc.signalingState !== 'stable');
          state.ignoreOffer = !state.polite && collision;
          if (state.ignoreOffer) return;

          await pc.setRemoteDescription(new RTCSessionDescription(typed.sdp));
          if (typed.kind === 'offer') {
            await pc.setLocalDescription();
            if (pc.localDescription) emitSignal(fromDeviceId, { kind: 'answer', sdp: pc.localDescription });
          }
        } else if (typed.kind === 'ice') {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(typed.candidate));
          } catch {
            if (!state.ignoreOffer) throw new Error('ice failed');
          }
        }
      } catch {
        // negotiation hiccup — connection state handler will surface real failures
      }
    };

    socket.on(ServerEvents.VOICE_PEER_JOINED, onPeerJoined);
    socket.on(ServerEvents.VOICE_PEER_LEFT, onPeerLeft);
    socket.on(ServerEvents.VOICE_PARTICIPANTS, onParticipants);
    socket.on(ServerEvents.VOICE_SIGNAL, onSignal);

    return () => {
      socket.off(ServerEvents.VOICE_PEER_JOINED, onPeerJoined);
      socket.off(ServerEvents.VOICE_PEER_LEFT, onPeerLeft);
      socket.off(ServerEvents.VOICE_PARTICIPANTS, onParticipants);
      socket.off(ServerEvents.VOICE_SIGNAL, onSignal);
    };
  }, [getOrCreatePeer]);

  const join = useCallback(async () => {
    stopRinging();
    setStatus('connecting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
      getSocket().emit(ClientEvents.VOICE_JOIN, { deviceId: deviceId.current });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[voice] failed to acquire microphone', err);
      setStatus('error');
    }
  }, [stopRinging]);

  const leave = useCallback(() => {
    getSocket().emit(ClientEvents.VOICE_LEAVE, { deviceId: deviceId.current });
    peersRef.current.forEach((s) => s.pc.close());
    peersRef.current.clear();
    remoteAudioElsRef.current.forEach((el) => el.pause());
    remoteAudioElsRef.current.clear();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    setLocalStream(null);
    setRemoteStreams({});
    stopLevelMeter();
    setStatus('idle');
    setCameraOn(false);
    setPeerDeviceIds([]);
    stopRinging();
  }, [stopRinging]);

  /** Adds/removes the camera track on the live call (renegotiates automatically). */
  const toggleCamera = useCallback(async () => {
    const stream = localStreamRef.current;
    if (!stream) return;

    const existingVideo = stream.getVideoTracks()[0];
    if (existingVideo) {
      // Turn camera OFF: drop the track from every peer connection.
      peersRef.current.forEach(({ pc }) => {
        const sender = pc.getSenders().find((s) => s.track === existingVideo);
        if (sender) pc.removeTrack(sender);
      });
      existingVideo.stop();
      stream.removeTrack(existingVideo);
      setLocalStream(new MediaStream(stream.getTracks()));
      setCameraOn(false);
      return;
    }

    // Turn camera ON.
    try {
      const camStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
      });
      const videoTrack = camStream.getVideoTracks()[0];
      if (!videoTrack) return;
      stream.addTrack(videoTrack);
      peersRef.current.forEach(({ pc }) => pc.addTrack(videoTrack, stream));
      setLocalStream(new MediaStream(stream.getTracks()));
      setCameraOn(true);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[voice] camera permission denied', err);
    }
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      localStreamRef.current?.getAudioTracks().forEach((t) => {
        t.enabled = !next;
      });
      getSocket().emit(ClientEvents.VOICE_MUTE_CHANGE, { deviceId: deviceId.current, muted: next });
      return next;
    });
  }, []);

  const toggleSpeaker = useCallback(() => {
    setSpeakerOn((prev) => {
      const next = !prev;
      remoteAudioElsRef.current.forEach((el) => {
        el.muted = !next;
      });
      return next;
    });
  }, []);

  useEffect(() => () => leave(), [leave]);

  return {
    status,
    incomingCall,
    /** Pick up: silences the ringtone and joins the call. */
    acceptCall: join,
    declineCall: stopRinging,
    muted,
    speakerOn,
    cameraOn,
    remoteLevel,
    peerDeviceIds,
    localStream,
    remoteStreams,
    join,
    leave,
    toggleMute,
    toggleSpeaker,
    toggleCamera,
  };
}
