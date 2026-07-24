'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useVoice } from '@/providers/voice-provider';

/**
 * A small floating face tile. Rendered only while the stream actually carries
 * a live video track, so audio-only callers don't get an empty black box.
 */
function FloatingTile({ stream, label, mirrored }: { stream: MediaStream; label: string; mirrored?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [hasVideo, setHasVideo] = useState(false);

  useEffect(() => {
    if (ref.current) {
      ref.current.srcObject = stream;
      ref.current.play().catch(() => undefined);
    }
    const sync = () => setHasVideo(stream.getVideoTracks().some((t) => t.readyState === 'live'));
    sync();
    stream.addEventListener('addtrack', sync);
    stream.addEventListener('removetrack', sync);
    // Tracks can also end without firing removetrack (camera turned off remotely).
    const poll = setInterval(sync, 1000);
    return () => {
      stream.removeEventListener('addtrack', sync);
      stream.removeEventListener('removetrack', sync);
      clearInterval(poll);
    };
  }, [stream]);

  return (
    <div className={hasVideo ? 'relative overflow-hidden rounded-2xl shadow-card ring-1 ring-white/10' : 'hidden'}>
      {/* muted: call audio already plays through the dedicated audio element */}
      <video
        ref={ref}
        autoPlay
        playsInline
        muted
        className={`h-32 w-24 bg-base-800 object-cover md:h-36 md:w-28 ${mirrored ? '-scale-x-100' : ''}`}
      />
      <span className="absolute bottom-1 left-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] text-white/90">
        {label}
      </span>
    </div>
  );
}

/**
 * A persistent, app-wide voice control. Because the voice session lives in
 * VoiceProvider (not any single page), you can join/mute voice from here on
 * ANY screen — e.g. keep talking on the Sync screen while the video plays.
 * Hidden on the dedicated /voice screen, which has its own big control.
 */
export function FloatingVoice() {
  const pathname = usePathname();
  const { status, muted, cameraOn, remoteLevel, localStream, remoteStreams, join, leave, toggleMute, toggleCamera } =
    useVoice();

  if (pathname?.startsWith('/voice')) return null;

  const inCall = status === 'connecting' || status === 'connected';
  const remotes = Object.entries(remoteStreams);

  return (
    <div className="fixed bottom-24 right-4 z-40 flex flex-col items-end gap-2 md:bottom-6 md:right-6">
      {/* Face tiles sit directly with the controls, so you see each other on
          every screen — not just the Sync page. Stacked above the buttons so
          they stay on-screen (the bar is already pinned near the bottom). */}
      {inCall && (
        <div className="flex flex-col items-end gap-2">
          {remotes.map(([peerId, stream]) => (
            <FloatingTile key={peerId} stream={stream} label="Partner" />
          ))}
          {localStream && <FloatingTile stream={localStream} label="You" mirrored />}
        </div>
      )}

      <AnimatePresence>
        {inCall ? (
          <motion.div
            key="in-call"
            initial={{ opacity: 0, scale: 0.9, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="glass flex items-center gap-2 rounded-full p-1.5 shadow-card"
          >
            <button
              onClick={toggleMute}
              className={`relative flex h-11 w-11 items-center justify-center rounded-full transition ${
                muted ? 'bg-white/10' : 'bg-gradient-to-br from-accent to-accent-muted'
              }`}
              aria-label={muted ? 'Unmute' : 'Mute'}
            >
              {!muted && (
                <span
                  className="absolute inset-0 rounded-full bg-accent/40 transition-transform"
                  style={{ transform: `scale(${1 + remoteLevel * 0.5})` }}
                />
              )}
              <span className="relative">
                <MicIcon muted={muted} />
              </span>
            </button>
            <button
              onClick={toggleCamera}
              className={`flex h-11 w-11 items-center justify-center rounded-full transition ${
                cameraOn ? 'bg-accent' : 'bg-white/10 hover:bg-white/20'
              }`}
              aria-label={cameraOn ? 'Turn camera off' : 'Turn camera on'}
            >
              <CameraIcon off={!cameraOn} />
            </button>
            <button
              onClick={leave}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-red-500/90 transition hover:bg-red-500"
              aria-label="End voice"
            >
              <EndIcon />
            </button>
          </motion.div>
        ) : (
          <motion.button
            key="idle"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            onClick={join}
            className="glass flex h-14 w-14 items-center justify-center rounded-full shadow-glow"
            aria-label="Start voice chat"
            title="Talk while you watch"
          >
            <MicIcon muted={false} />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

function MicIcon({ muted }: { muted: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={1.8}>
      <rect x="9" y="3" width="6" height="11" rx="3" fill={muted ? 'none' : 'white'} stroke="white" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" strokeLinecap="round" />
      {muted && <path d="M4 4l16 16" strokeLinecap="round" />}
    </svg>
  );
}

function CameraIcon({ off }: { off?: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={1.8}>
      <rect x="3" y="6" width="12" height="12" rx="2" />
      <path d="M15 10.5 21 7v10l-6-3.5" strokeLinejoin="round" />
      {off && <path d="M4 4l16 16" strokeLinecap="round" />}
    </svg>
  );
}

function EndIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
      <path d="M12 9c-2.4 0-4.7.5-6.8 1.4a1.5 1.5 0 0 0-.8 1.9l1 2.7c.2.6.8 1 1.4.9 1-.1 1.9-.5 2.7-1.1.3-.2.7-.3 1-.1.8.4 1.7.6 2.5.6s1.7-.2 2.5-.6c.3-.2.7-.1 1 .1.8.6 1.7 1 2.7 1.1.6.1 1.2-.3 1.4-.9l1-2.7a1.5 1.5 0 0 0-.8-1.9C16.7 9.5 14.4 9 12 9Z" />
    </svg>
  );
}
