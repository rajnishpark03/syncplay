'use client';

import { useEffect, useRef, useState } from 'react';
import { GlassCard } from '@/components/ui/glass-card';
import { useVoice } from '@/providers/voice-provider';
import { MicIcon } from '@/components/ui/icons';

function VideoTile({ stream, label, muted, mirrored }: { stream: MediaStream; label: string; muted: boolean; mirrored?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [hasVideo, setHasVideo] = useState(stream.getVideoTracks().length > 0);

  useEffect(() => {
    if (ref.current) {
      ref.current.srcObject = stream;
      ref.current.play().catch(() => undefined);
    }
    // Track list changes when the camera is toggled mid-call.
    const sync = () => setHasVideo(stream.getVideoTracks().length > 0);
    sync();
    stream.addEventListener('addtrack', sync);
    stream.addEventListener('removetrack', sync);
    return () => {
      stream.removeEventListener('addtrack', sync);
      stream.removeEventListener('removetrack', sync);
    };
  }, [stream]);

  return (
    <div className="relative overflow-hidden rounded-2xl bg-base-800">
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={muted}
        className={`aspect-[3/4] w-full object-cover ${mirrored ? '-scale-x-100' : ''} ${hasVideo ? '' : 'hidden'}`}
      />
      {!hasVideo && (
        <div className="flex aspect-[3/4] w-full items-center justify-center bg-gradient-to-br from-accent/20 to-base-800">
          <MicIcon className="text-2xl text-white/25" />
        </div>
      )}
      <span className="absolute bottom-2 left-2 rounded-full bg-black/50 px-2 py-0.5 text-[11px] text-white/90">{label}</span>
    </div>
  );
}

/**
 * Face-cam tiles beside the player so you can see each other while watching.
 * Starting the camera from here also joins voice if you aren't in it yet, so
 * it's a single tap from anywhere on the Sync screen.
 */
export function CameraPanel({ memberNames }: { memberNames: Record<string, string> }) {
  const { status, localStream, remoteStreams, cameraOn, join, toggleCamera } = useVoice();
  const [starting, setStarting] = useState(false);
  const inCall = status === 'connecting' || status === 'connected';
  const remotes = Object.entries(remoteStreams);

  async function handleToggleCamera() {
    setStarting(true);
    try {
      if (!inCall) await join(); // grabs the mic + announces us to the room
      await toggleCamera();
    } finally {
      setStarting(false);
    }
  }

  return (
    <GlassCard hoverable={false} className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-white/70">Camera</h3>
        <button
          onClick={handleToggleCamera}
          disabled={starting}
          className={`rounded-full px-3 py-1 text-xs transition disabled:opacity-50 ${
            cameraOn ? 'bg-accent text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'
          }`}
        >
          {starting ? 'Starting…' : cameraOn ? 'Camera on' : 'Turn on camera'}
        </button>
      </div>

      {!inCall && !starting && (
        <p className="text-xs text-white/30">
          Turn on your camera to see each other while you watch. Your mic joins too.
        </p>
      )}

      <div className="space-y-3">
        {localStream && <VideoTile stream={localStream} label="You" muted mirrored />}
        {remotes.map(([peerId, stream]) => (
          <VideoTile key={peerId} stream={stream} label={memberNames[peerId] ?? 'Partner'} muted />
        ))}
        {inCall && remotes.length === 0 && <p className="text-xs text-white/30">Waiting for your partner to join…</p>}
      </div>
    </GlassCard>
  );
}
