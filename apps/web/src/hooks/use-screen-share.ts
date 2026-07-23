'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ClientEvents, ServerEvents } from '@syncplay/shared';
import { getSocket } from '@/lib/socket';
import { getOrCreateDeviceId } from '@/lib/device';

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

// Generous ceilings — WebRTC's congestion control will still back off under a
// genuinely bad network (that's what keeps the call alive at all), but
// nothing here artificially caps quality below what the network can carry,
// and 'maintain-resolution' tells the encoder to drop framerate before it
// drops resolution/sharpness if it ever has to choose.
const VIDEO_MAX_BITRATE_BPS = 8_000_000; // ~8 Mbps: comfortable for sharp 1080p30
const AUDIO_MAX_BITRATE_BPS = 256_000; // well above default voice-call Opus bitrates

type Signal =
  | { kind: 'offer'; sdp: RTCSessionDescriptionInit }
  | { kind: 'answer'; sdp: RTCSessionDescriptionInit }
  | { kind: 'ice'; candidate: RTCIceCandidateInit };

export type ScreenShareStatus = 'idle' | 'sharing' | 'error';

/**
 * Screen sharing is fully bidirectional and independent of voice: this device
 * can be sharing (one or more outgoing peer connections, one per viewer) AND
 * watching someone else's share (one incoming connection) at the same time.
 */
export function useScreenShare(otherDeviceIds: string[]) {
  const [status, setStatus] = useState<ScreenShareStatus>('idle');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [remoteSharerId, setRemoteSharerId] = useState<string | null>(null);

  const deviceId = useRef(getOrCreateDeviceId());
  const localStreamRef = useRef<MediaStream | null>(null);
  const sharingRef = useRef(false);
  const remoteSharerIdRef = useRef<string | null>(null);
  const outgoingPeersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  // One incoming connection per remote sharer (keyed by their deviceId).
  const incomingPeersRef = useRef<Map<string, RTCPeerConnection>>(new Map());

  const applyHighQualityEncoding = useCallback(async (pc: RTCPeerConnection) => {
    for (const sender of pc.getSenders()) {
      if (!sender.track) continue;
      const params = sender.getParameters();
      params.encodings = params.encodings?.length ? params.encodings : [{}];

      if (sender.track.kind === 'video') {
        params.encodings[0].maxBitrate = VIDEO_MAX_BITRATE_BPS;
        params.degradationPreference = 'maintain-resolution';
      } else if (sender.track.kind === 'audio') {
        params.encodings[0].maxBitrate = AUDIO_MAX_BITRATE_BPS;
      }

      try {
        await sender.setParameters(params);
      } catch {
        // Some browsers reject certain fields — best effort, not fatal.
      }
    }
  }, []);

  const offerTo = useCallback(
    async (peerId: string) => {
      if (outgoingPeersRef.current.has(peerId) || !localStreamRef.current) return;

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      localStreamRef.current.getTracks().forEach((track) => pc.addTrack(track, localStreamRef.current!));

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          getSocket().emit(ClientEvents.SCREEN_SIGNAL, {
            deviceId: deviceId.current,
            targetDeviceId: peerId,
            signal: { kind: 'ice', candidate: event.candidate.toJSON() } satisfies Signal,
          });
        }
      };

      outgoingPeersRef.current.set(peerId, pc);
      await applyHighQualityEncoding(pc);

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      getSocket().emit(ClientEvents.SCREEN_SIGNAL, {
        deviceId: deviceId.current,
        targetDeviceId: peerId,
        signal: { kind: 'offer', sdp: offer } satisfies Signal,
      });
    },
    [applyHighQualityEncoding],
  );

  const stopSharing = useCallback(() => {
    if (!sharingRef.current) return;
    sharingRef.current = false;
    getSocket().emit(ClientEvents.SCREEN_STOP, { deviceId: deviceId.current });
    outgoingPeersRef.current.forEach((pc) => pc.close());
    outgoingPeersRef.current.clear();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    setLocalStream(null);
    setStatus('idle');
  }, []);

  const startSharing = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30, max: 30 },
        },
        audio: {
          // These are voice-call filters — they degrade music/movie audio
          // fidelity, so they're explicitly off for a screen-share capture.
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      localStreamRef.current = stream;
      sharingRef.current = true;
      setLocalStream(stream);
      setStatus('sharing');
      getSocket().emit(ClientEvents.SCREEN_START, { deviceId: deviceId.current });

      // Stopping via the browser's native "Stop sharing" bar.
      stream.getVideoTracks()[0]?.addEventListener('ended', () => stopSharing());

      await Promise.all(otherDeviceIds.map((peerId) => offerTo(peerId)));
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[screen-share] failed to start', err);
      setStatus('error');
    }
  }, [otherDeviceIds, offerTo, stopSharing]);

  // If someone joins the room while we're already sharing, start streaming to
  // them too — otherwise late joiners would never see the screen.
  useEffect(() => {
    if (!sharingRef.current) return;
    otherDeviceIds.forEach((peerId) => offerTo(peerId));
    // Drop connections to peers who left.
    outgoingPeersRef.current.forEach((pc, peerId) => {
      if (!otherDeviceIds.includes(peerId)) {
        pc.close();
        outgoingPeersRef.current.delete(peerId);
      }
    });
  }, [otherDeviceIds, offerTo]);

  useEffect(() => {
    const socket = getSocket();

    const onPeerStopped = ({ deviceId: id }: { deviceId: string }) => {
      incomingPeersRef.current.get(id)?.close();
      incomingPeersRef.current.delete(id);
      if (id === remoteSharerIdRef.current) {
        remoteSharerIdRef.current = null;
        setRemoteSharerId(null);
        setRemoteStream(null);
      }
    };

    const onSignal = async ({ fromDeviceId, signal }: { fromDeviceId: string; signal: Signal }) => {
      if (signal.kind === 'offer') {
        // Incoming share from a peer.
        incomingPeersRef.current.get(fromDeviceId)?.close();
        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        pc.ontrack = (event) => {
          remoteSharerIdRef.current = fromDeviceId;
          setRemoteSharerId(fromDeviceId);
          setRemoteStream(event.streams[0]);
        };
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            getSocket().emit(ClientEvents.SCREEN_SIGNAL, {
              deviceId: deviceId.current,
              targetDeviceId: fromDeviceId,
              signal: { kind: 'ice', candidate: event.candidate.toJSON() } satisfies Signal,
            });
          }
        };
        incomingPeersRef.current.set(fromDeviceId, pc);

        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        getSocket().emit(ClientEvents.SCREEN_SIGNAL, {
          deviceId: deviceId.current,
          targetDeviceId: fromDeviceId,
          signal: { kind: 'answer', sdp: answer } satisfies Signal,
        });
      } else if (signal.kind === 'answer') {
        const pc = outgoingPeersRef.current.get(fromDeviceId);
        if (pc && !pc.currentRemoteDescription) {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        }
      } else if (signal.kind === 'ice') {
        const pc = outgoingPeersRef.current.get(fromDeviceId) ?? incomingPeersRef.current.get(fromDeviceId);
        try {
          await pc?.addIceCandidate(new RTCIceCandidate(signal.candidate));
        } catch {
          // benign if it arrives before the remote description is set
        }
      }
    };

    socket.on(ServerEvents.SCREEN_PEER_STOPPED, onPeerStopped);
    socket.on(ServerEvents.SCREEN_SIGNAL, onSignal);

    return () => {
      socket.off(ServerEvents.SCREEN_PEER_STOPPED, onPeerStopped);
      socket.off(ServerEvents.SCREEN_SIGNAL, onSignal);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => stopSharing(), [stopSharing]);

  return { status, localStream, remoteStream, remoteSharerId, startSharing, stopSharing };
}
