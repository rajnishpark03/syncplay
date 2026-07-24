'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { MediaPlayerHandle } from '@/components/sync/media-player';
import { useSync } from '@/providers/sync-provider';

/** Vendor-prefixed fullscreen bits that TypeScript's lib doesn't declare. */
type FsDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};
type FsElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };

/** Where the big player should be drawn, in viewport coordinates. */
export interface PlayerSlot {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface PlayerContextValue {
  playerRef: React.RefObject<MediaPlayerHandle>;
  /** The element that goes fullscreen (wraps the video/iframe). */
  containerRef: React.RefObject<HTMLDivElement>;
  isFullscreen: boolean;
  toggleFullscreen: () => void;
  /** Live position of the local element, ticked by the drift loop. */
  localPositionMs: number;
  durationMs: number;
  setMediaDurationMs: (ms: number) => void;
  seekingRef: React.MutableRefObject<boolean>;
  /** The Sync screen publishes the rectangle it wants the player drawn into. */
  slot: PlayerSlot | null;
  setSlot: (slot: PlayerSlot | null) => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

// Direct <video>/<audio> seeks are effectively instant (local/CDN buffered), so
// we can hold them to the <100ms sync target. YouTube's IFrame player has real
// seek latency — checking drift again before that settles causes a seek loop
// that looks like continuous buffering, hence the looser threshold + cooldown.
const DRIFT_THRESHOLD_MS = { direct: 150, youtube: 1200 } as const;
const CORRECTION_COOLDOWN_MS = { direct: 0, youtube: 2500 } as const;
const DRIFT_CHECK_INTERVAL_MS = 800;

/**
 * Owns the one and only media player for the whole authenticated app.
 *
 * Mounted at the app-layout level (not inside a page) so navigating to Games,
 * Home, Settings… never unmounts the player — the music/video just keeps
 * playing. The Sync screen only publishes a rectangle (`slot`) telling the
 * persistent player where to draw itself; everywhere else it shrinks to a mini
 * player. Nothing ever re-parents the <video>/iframe, which is what would
 * actually interrupt playback.
 */
export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const { mediaState, expectedPositionMs } = useSync();
  const playerRef = useRef<MediaPlayerHandle>(null);
  const seekingRef = useRef(false);
  const lastCorrectionAtRef = useRef(0);
  const [localPositionMs, setLocalPositionMs] = useState(0);
  const [mediaDurationMs, setMediaDurationMs] = useState(0);
  const [slot, setSlot] = useState<PlayerSlot | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Track fullscreen from the document, so the Esc key / native exit button
  // keep our UI in sync rather than only our own toggle.
  useEffect(() => {
    const onChange = () =>
      setIsFullscreen(Boolean(document.fullscreenElement || (document as FsDocument).webkitFullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
    };
  }, []);

  const toggleFullscreen = useCallback(() => {
    const doc = document as FsDocument;
    if (doc.fullscreenElement || doc.webkitFullscreenElement) {
      (doc.exitFullscreen?.() ?? doc.webkitExitFullscreen?.())?.catch?.(() => undefined);
      return;
    }
    const el = containerRef.current as FsElement | null;
    if (!el) return;
    const request = el.requestFullscreen?.bind(el) ?? el.webkitRequestFullscreen?.bind(el);
    if (request) {
      Promise.resolve(request()).catch(() => undefined);
    } else {
      // iOS Safari only allows fullscreen on the <video> element itself.
      playerRef.current?.enterNativeFullscreen?.();
    }
  }, []);

  const provider = mediaState.track?.provider ?? 'direct';
  const durationMs = mediaDurationMs || mediaState.track?.durationMs || 0;

  useEffect(() => {
    setMediaDurationMs(0);
  }, [mediaState.track?.id]);

  // Apply server-driven play/pause + resync whenever the room's state changes.
  useEffect(() => {
    const player = playerRef.current;
    if (!player || !mediaState.track) return;

    const target = expectedPositionMs();
    if (Math.abs(player.getCurrentTimeMs() - target) > 1000) {
      player.seekTo(target);
      lastCorrectionAtRef.current = Date.now();
    }
    if (mediaState.state === 'playing' && player.isPaused()) player.play();
    else if (mediaState.state === 'paused' && !player.isPaused()) player.pause();
    player.setRate(mediaState.playbackRate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaState.track?.id, mediaState.state, mediaState.updatedAt]);

  // Continuous drift correction — keeps both devices within ~100ms.
  useEffect(() => {
    const interval = setInterval(() => {
      const player = playerRef.current;
      if (!player || seekingRef.current) return;

      const expected = expectedPositionMs();
      const current = player.getCurrentTimeMs();
      setLocalPositionMs(current || expected);

      if (mediaState.state !== 'playing') return;

      // Should be playing but isn't (blocked autoplay, user hit the native
      // controls, buffering ended paused) — resume instead of re-seeking a
      // frozen player, which used to look like a stuck buffering loop.
      if (player.isPaused()) {
        player.play();
        return;
      }

      const cooldown = CORRECTION_COOLDOWN_MS[provider];
      if (cooldown && Date.now() - lastCorrectionAtRef.current < cooldown) return;

      if (Math.abs(current - expected) > DRIFT_THRESHOLD_MS[provider]) {
        player.seekTo(expected);
        lastCorrectionAtRef.current = Date.now();
      }
    }, DRIFT_CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [expectedPositionMs, mediaState.state, provider]);

  const setSlotStable = useCallback((next: PlayerSlot | null) => setSlot(next), []);

  return (
    <PlayerContext.Provider
      value={{
        playerRef,
        containerRef,
        isFullscreen,
        toggleFullscreen,
        localPositionMs,
        durationMs,
        setMediaDurationMs,
        seekingRef,
        slot,
        setSlot: setSlotStable,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider');
  return ctx;
}
