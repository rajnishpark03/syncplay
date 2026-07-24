'use client';

import { useEffect, useRef } from 'react';
import { GlassCard } from '@/components/ui/glass-card';
import { useVoice } from '@/providers/voice-provider';

function VideoTile({ stream, label, muted, mirrored }: { stream: MediaStream; label: string; muted: boolean; mirrored?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.srcObject = stream;
      ref.current.play().catch(() => undefined);
    }
  }, [stream]);

  const hasVideo = stream.getVideoTracks().some((t) => t.readyState === 'live');

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
          <span className="text-3xl">🎧</span>
        </div>
      )}
      <span className="absolute bottom-2 left-2 rounded-full bg-black/50 px-2 py-0.5 text-[11px] text-white/90">{label}</span>
    </div>
  );
}

/**
 * Face-cam tiles for the people in the room, shown beside the player so you
 * can see each other while watching. Only rendered once voice is connected.
 */
export function CameraPanel({ memberNames }: { memberNames: Record<string, string> }) {
  const { status, localStream, remoteStreams, cameraOn, toggleCamera } = useVoice();
  const inCall = status === 'connecting' || status === 'connected';

  if (!inCall) return null;

  const remotes = Object.entries(remoteStreams);

  return (
    <GlassCard hoverable={false} className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white/70">Camera</h3>
        <button
          onClick={toggleCamera}
          className={`rounded-full px-3 py-1 text-xs transition ${
            cameraOn ? 'bg-accent text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'
          }`}
        >
          {cameraOn ? 'Camera on' : 'Turn on camera'}
        </button>
      </div>

      <div className="space-y-3">
        {localStream && <VideoTile stream={localStream} label="You" muted mirrored />}
        {remotes.map(([peerId, stream]) => (
          <VideoTile key={peerId} stream={stream} label={memberNames[peerId] ?? 'Partner'} muted />
        ))}
        {remotes.length === 0 && (
          <p className="text-xs text-white/30">Waiting for your partner to join voice…</p>
        )}
      </div>
    </GlassCard>
  );
}
