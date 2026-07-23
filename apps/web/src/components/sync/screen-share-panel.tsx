'use client';

import { useEffect, useRef, useState } from 'react';
import { GlassCard } from '@/components/ui/glass-card';
import { useScreenShare } from '@/hooks/use-screen-share';

export function ScreenSharePanel({ otherDeviceIds }: { otherDeviceIds: string[] }) {
  const { status, localStream, remoteStream, startSharing, stopSharing } = useScreenShare(otherDeviceIds);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteWrapRef = useRef<HTMLDivElement>(null);
  const [remoteMuted, setRemoteMuted] = useState(true);

  function enterFullscreen(el: HTMLElement | null, video: HTMLVideoElement | null) {
    if (!el) return;
    // iOS Safari only allows fullscreen on the <video> element itself.
    const iosVideo = video as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    const target = el as HTMLElement & { webkitRequestFullscreen?: () => void };
    if (target.requestFullscreen) target.requestFullscreen().catch(() => undefined);
    else if (target.webkitRequestFullscreen) target.webkitRequestFullscreen();
    else if (iosVideo?.webkitEnterFullscreen) iosVideo.webkitEnterFullscreen();
  }

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play().catch(() => undefined);
    }
  }, [remoteStream]);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch(() => undefined);
    }
  }, [localStream]);

  const isSharing = status === 'sharing';

  return (
    <GlassCard hoverable={false}>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white/70">Screen Share</h3>
          <p className="text-xs text-white/40">
            {isSharing
              ? 'You are sharing your screen'
              : remoteStream
                ? 'Watching a shared screen'
                : 'Share your screen in high quality'}
          </p>
        </div>
        {isSharing ? (
          <button className="btn-secondary text-xs text-red-300 hover:text-red-200" onClick={stopSharing}>
            Stop sharing
          </button>
        ) : (
          <button className="btn-primary text-xs" onClick={startSharing} disabled={otherDeviceIds.length === 0}>
            Share screen
          </button>
        )}
      </div>

      {status === 'error' && (
        <p className="text-xs text-red-400">
          Couldn&rsquo;t start screen sharing — permission was denied or your browser blocked it.
        </p>
      )}

      {otherDeviceIds.length === 0 && !isSharing && !remoteStream && (
        <p className="text-xs text-white/30">Waiting for someone else to join the room before you can share.</p>
      )}

      {/* Watching someone else's screen */}
      {remoteStream && (
        <div ref={remoteWrapRef} className="relative mt-2 overflow-hidden rounded-xl bg-black">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            muted={remoteMuted}
            className="aspect-video w-full bg-black object-contain"
          />
          <div className="absolute bottom-3 right-3 flex gap-2">
            {remoteMuted && (
              <button
                onClick={() => {
                  setRemoteMuted(false);
                  remoteVideoRef.current?.play().catch(() => undefined);
                }}
                className="glass rounded-full px-3 py-1.5 text-xs text-white/90"
              >
                🔇 Tap for sound
              </button>
            )}
            <button
              onClick={() => enterFullscreen(remoteWrapRef.current, remoteVideoRef.current)}
              className="glass rounded-full px-3 py-1.5 text-xs text-white/90"
              aria-label="Fullscreen"
            >
              ⛶ Fullscreen
            </button>
          </div>
        </div>
      )}

      {/* Your own live preview while sharing */}
      {isSharing && localStream && (
        <div className="mt-2 overflow-hidden rounded-xl bg-black">
          <video ref={localVideoRef} autoPlay playsInline muted className="aspect-video w-full object-contain" />
          <p className="px-3 py-2 text-xs text-white/30">
            Your shared screen (muted preview). For Netflix/DRM video, some sites show a black frame in capture — SD usually
            works, HD/4K may not.
          </p>
        </div>
      )}
    </GlassCard>
  );
}
