'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { TrackInfo } from '@orbit/shared';
import { loadYouTubeIframeApi, YTPlayer } from '@/lib/youtube-iframe-api';

export interface MediaPlayerHandle {
  getCurrentTimeMs(): number;
  isPaused(): boolean;
  play(): void;
  pause(): void;
  seekTo(ms: number): void;
  setRate(rate: number): void;
  isMuted(): boolean;
  toggleMute(): void;
}

interface Props {
  track: TrackInfo | null;
  isVideo: boolean;
  onDurationChange: (ms: number) => void;
  onEnded: () => void;
}

/**
 * Plays either a direct media URL (native <video>, works for audio too) or a
 * YouTube video via the official IFrame Player API, behind one imperative
 * handle so the drift-correction loop in the Sync screen doesn't need to
 * know which one is active.
 *
 * Every new track starts muted. Browsers block unmuted `play()`/`playVideo()`
 * calls that aren't a direct result of a user gesture — and a play triggered
 * by an incoming `media:play` socket event (the whole point of sync) never
 * is one. Starting muted keeps autoplay reliable; an on-screen "Unmute"
 * button lets the user opt in with a real click.
 */
export const MediaPlayer = forwardRef<MediaPlayerHandle, Props>(function MediaPlayer(
  { track, isVideo, onDurationChange, onEnded },
  ref,
) {
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;
  const videoRef = useRef<HTMLVideoElement>(null);
  const ytContainerRef = useRef<HTMLDivElement>(null);
  const ytPlayerRef = useRef<YTPlayer | null>(null);
  const loadedVideoIdRef = useRef<string | null>(null);
  const [ytReady, setYtReady] = useState(false);
  const [muted, setMuted] = useState(true);
  const isYoutube = track?.provider === 'youtube';

  useEffect(() => {
    setMuted(true);
  }, [track?.id]);

  useEffect(() => {
    if (isYoutube) {
      if (ytReady) {
        if (muted) ytPlayerRef.current?.mute();
        else ytPlayerRef.current?.unMute();
      }
    } else if (videoRef.current) {
      videoRef.current.muted = muted;
    }
  }, [muted, isYoutube, ytReady]);

  useEffect(() => {
    if (!isYoutube) {
      if (ytPlayerRef.current) {
        ytPlayerRef.current.destroy();
        ytPlayerRef.current = null;
        loadedVideoIdRef.current = null;
        setYtReady(false);
      }
      return;
    }
    if (!track || !ytContainerRef.current) return;

    let cancelled = false;

    if (!ytPlayerRef.current) {
      // First video in this session: create the player. YouTube's API
      // REPLACES the target element with an <iframe> — it must only ever be
      // constructed once per container, never re-created on every track
      // change (that targets an already-replaced/detached node and silently
      // fails to load the new video).
      setYtReady(false);
      loadYouTubeIframeApi().then((YT) => {
        if (cancelled || !ytContainerRef.current || ytPlayerRef.current) return;
        loadedVideoIdRef.current = track.sourceUrl;
        ytPlayerRef.current = new YT.Player(ytContainerRef.current, {
          videoId: track.sourceUrl,
          // controls: 0 hides YouTube's own play/pause bar and title/info
          // overlay entirely — Orbit's own controls below the video are
          // the only playback UI shown, matching direct-URL tracks.
          playerVars: { playsinline: 1, controls: 0, disablekb: 1, iv_load_policy: 3, modestbranding: 1, rel: 0, mute: 1 },
          events: {
            onReady: () => {
              if (cancelled) return;
              setYtReady(true);
              const duration = ytPlayerRef.current?.getDuration() ?? 0;
              if (duration) onDurationChange(duration * 1000);
            },
            onStateChange: (event) => {
              // 0 === YT.PlayerState.ENDED
              if (event.data === 0) onEndedRef.current();
            },
          },
        });
      });
    } else if (loadedVideoIdRef.current !== track.sourceUrl) {
      // Switching to a different video on an existing player — the
      // API-recommended way to do this without recreating the iframe.
      loadedVideoIdRef.current = track.sourceUrl;
      onDurationChange(0);
      ytPlayerRef.current.loadVideoById(track.sourceUrl);
    }

    return () => {
      cancelled = true;
    };
  }, [isYoutube, track, onDurationChange]);

  // Full teardown when the player leaves the page entirely.
  useEffect(
    () => () => {
      ytPlayerRef.current?.destroy();
      ytPlayerRef.current = null;
    },
    [],
  );

  useImperativeHandle(
    ref,
    (): MediaPlayerHandle => ({
      getCurrentTimeMs: () => {
        if (isYoutube) return ytReady ? (ytPlayerRef.current?.getCurrentTime() ?? 0) * 1000 : 0;
        return (videoRef.current?.currentTime ?? 0) * 1000;
      },
      isPaused: () => {
        if (isYoutube) return ytReady ? ytPlayerRef.current?.getPlayerState() !== 1 : true;
        return videoRef.current?.paused ?? true;
      },
      play: () => {
        if (isYoutube) {
          if (ytReady) ytPlayerRef.current?.playVideo();
        } else {
          videoRef.current?.play().catch(() => undefined);
        }
      },
      pause: () => {
        if (isYoutube) {
          if (ytReady) ytPlayerRef.current?.pauseVideo();
        } else {
          videoRef.current?.pause();
        }
      },
      seekTo: (ms) => {
        if (isYoutube) {
          if (ytReady) ytPlayerRef.current?.seekTo(ms / 1000, true);
        } else if (videoRef.current) {
          videoRef.current.currentTime = ms / 1000;
        }
      },
      setRate: (rate) => {
        if (isYoutube) {
          if (ytReady) ytPlayerRef.current?.setPlaybackRate(rate);
        } else if (videoRef.current) {
          videoRef.current.playbackRate = rate;
        }
      },
      isMuted: () => muted,
      toggleMute: () => setMuted((m) => !m),
    }),
    [isYoutube, ytReady, muted],
  );

  return (
    <div className="relative">
      {muted && track && (
        <button
          onClick={() => setMuted(false)}
          className="glass absolute right-3 top-3 z-10 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-white/90"
        >
          🔇 Tap to unmute
        </button>
      )}

      {isYoutube ? (
        <div className="aspect-video w-full overflow-hidden bg-black">
          <div ref={ytContainerRef} className="h-full w-full" />
        </div>
      ) : (
        <div
          className={
            isVideo
              ? 'aspect-video bg-black'
              : 'flex aspect-square items-center justify-center bg-gradient-to-br from-accent/30 to-base-800'
          }
        >
          <video
            ref={videoRef}
            src={track?.sourceUrl}
            className={isVideo ? 'h-full w-full object-contain' : 'hidden'}
            playsInline
            muted={muted}
            onLoadedMetadata={(e) => onDurationChange(e.currentTarget.duration * 1000)}
            onEnded={() => onEndedRef.current()}
          />
          {!isVideo && track && (track.artworkUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={track.artworkUrl} alt="" className="h-40 w-40 rounded-2xl object-cover shadow-card" />
          ) : (
            <span className="text-6xl">🎵</span>
          ))}
          {!track && (
            <div className="flex h-full min-h-[220px] w-full flex-col items-center justify-center gap-3 text-white/40">
              <span className="text-4xl">🎧</span>
              <p className="text-sm">Nothing playing yet</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
});
