'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ClientEvents, ServerEvents, VoicePeerJoinedPayload, VoiceSignalRelayPayload } from '@syncplay/shared';
import { getSocket } from '@/lib/socket';
import { getOrCreateDeviceId } from '@/lib/device';

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

type Signal = { kind: 'offer' | 'answer'; sdp: RTCSessionDescriptionInit } | { kind: 'ice'; candidate: RTCIceCandidateInit };

export type VoiceStatus = 'idle' | 'connecting' | 'connected' | 'error';

export function useVoiceChat() {
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [muted, setMuted] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [remoteLevel, setRemoteLevel] = useState(0); // 0..1, drives wave animation
  const [peerDeviceIds, setPeerDeviceIds] = useState<string[]>([]);

  const deviceId = useRef(getOrCreateDeviceId());
  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteAudioElsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const analyserRef = useRef<{ ctx: AudioContext; frame: number } | null>(null);

  const createPeerConnection = useCallback((peerId: string) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    localStreamRef.current?.getTracks().forEach((track) => {
      pc.addTrack(track, localStreamRef.current!);
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        getSocket().emit(ClientEvents.VOICE_SIGNAL, {
          deviceId: deviceId.current,
          targetDeviceId: peerId,
          signal: { kind: 'ice', candidate: event.candidate.toJSON() } satisfies Signal,
        });
      }
    };

    pc.ontrack = (event) => {
      let audioEl = remoteAudioElsRef.current.get(peerId);
      if (!audioEl) {
        audioEl = new Audio();
        audioEl.autoplay = true;
        remoteAudioElsRef.current.set(peerId, audioEl);
      }
      audioEl.srcObject = event.streams[0];
      startLevelMeter(event.streams[0]);
      setStatus('connected');
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        setStatus((s) => (s === 'connected' ? 'connecting' : s));
      }
    };

    peersRef.current.set(peerId, pc);
    return pc;
  }, []);

  const startLevelMeter = (stream: MediaStream) => {
    if (analyserRef.current) return;
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

  const callPeer = useCallback(
    async (peerId: string) => {
      const pc = createPeerConnection(peerId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      getSocket().emit(ClientEvents.VOICE_SIGNAL, {
        deviceId: deviceId.current,
        targetDeviceId: peerId,
        signal: { kind: 'offer', sdp: offer } satisfies Signal,
      });
    },
    [createPeerConnection],
  );

  useEffect(() => {
    const socket = getSocket();

    const onPeerJoined = (payload: VoicePeerJoinedPayload) => {
      setPeerDeviceIds((prev) => Array.from(new Set([...prev, payload.deviceId])));
    };

    const onPeerLeft = ({ deviceId: peerId }: { deviceId: string }) => {
      peersRef.current.get(peerId)?.close();
      peersRef.current.delete(peerId);
      remoteAudioElsRef.current.get(peerId)?.pause();
      remoteAudioElsRef.current.delete(peerId);
      setPeerDeviceIds((prev) => prev.filter((id) => id !== peerId));
      stopLevelMeter();
    };

    const onParticipants = (existingPeerIds: string[]) => {
      existingPeerIds.forEach((peerId) => callPeer(peerId));
      setPeerDeviceIds(existingPeerIds);
    };

    const onSignal = async ({ fromDeviceId, signal }: VoiceSignalRelayPayload & { targetDeviceId?: string }) => {
      const typed = signal as Signal;
      let pc = peersRef.current.get(fromDeviceId);

      if (typed.kind === 'offer') {
        pc ??= createPeerConnection(fromDeviceId);
        await pc.setRemoteDescription(new RTCSessionDescription(typed.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        getSocket().emit(ClientEvents.VOICE_SIGNAL, {
          deviceId: deviceId.current,
          targetDeviceId: fromDeviceId,
          signal: { kind: 'answer', sdp: answer } satisfies Signal,
        });
      } else if (typed.kind === 'answer' && pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(typed.sdp));
      } else if (typed.kind === 'ice' && pc) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(typed.candidate));
        } catch {
          // benign if candidate arrives before remote description is set
        }
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
  }, [callPeer, createPeerConnection]);

  const join = useCallback(async () => {
    setStatus('connecting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      localStreamRef.current = stream;
      getSocket().emit(ClientEvents.VOICE_JOIN, { deviceId: deviceId.current });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[voice] failed to acquire microphone', err);
      setStatus('error');
    }
  }, []);

  const leave = useCallback(() => {
    getSocket().emit(ClientEvents.VOICE_LEAVE, { deviceId: deviceId.current });
    peersRef.current.forEach((pc) => pc.close());
    peersRef.current.clear();
    remoteAudioElsRef.current.forEach((el) => el.pause());
    remoteAudioElsRef.current.clear();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    stopLevelMeter();
    setStatus('idle');
    setPeerDeviceIds([]);
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      localStreamRef.current?.getAudioTracks().forEach((track) => {
        track.enabled = !next;
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

  return { status, muted, speakerOn, remoteLevel, peerDeviceIds, join, leave, toggleMute, toggleSpeaker };
}
