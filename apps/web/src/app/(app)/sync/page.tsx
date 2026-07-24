'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { GlassCard } from '@/components/ui/glass-card';
import { RoomGate } from '@/components/room/room-gate';
import { PlayerSlot } from '@/components/sync/player-slot';
import { ScreenSharePanel } from '@/components/sync/screen-share-panel';
import { CameraPanel } from '@/components/sync/camera-panel';
import { useSyncEngine } from '@/hooks/use-sync-engine';
import { usePlayer } from '@/providers/player-provider';
import { extractYouTubeId, fetchYouTubeOEmbed } from '@/lib/youtube';
import type { MediaProvider, MediaType, TrackInfo } from '@orbit/shared';

function formatTime(ms: number) {
  if (!Number.isFinite(ms) || ms < 0) ms = 0;
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

interface LoaderForm {
  title: string;
  subtitle: string;
  sourceUrl: string;
  artworkUrl: string;
  mediaType: MediaType;
  provider: MediaProvider;
}

const EMPTY_FORM: LoaderForm = { title: '', subtitle: '', sourceUrl: '', artworkUrl: '', mediaType: 'music', provider: 'direct' };

export default function SyncPage() {
  return (
    <RoomGate>
      <SyncSession />
    </RoomGate>
  );
}

function SyncSession() {
  const {
    mediaState,
    syncHealth,
    connected,
    roomCode,
    members,
    deviceId,
    play,
    pause,
    seek,
    changeTrack,
    changeSpeed,
    addToQueue,
    removeFromQueue,
    skip,
  } = useSyncEngine();
  // The player itself lives in PlayerProvider so music keeps playing when you
  // navigate to Games/Home — this screen only drives its controls.
  const { playerRef, localPositionMs, durationMs, seekingRef } = usePlayer();
  const [showLoader, setShowLoader] = useState(false);
  const [form, setForm] = useState<LoaderForm>(EMPTY_FORM);
  const otherDeviceIds = members.filter((m) => m.deviceId !== deviceId).map((m) => m.deviceId);
  const memberNames = Object.fromEntries(members.map((m) => [m.deviceId, m.deviceName]));

  function handleTogglePlay() {
    const player = playerRef.current;
    if (!player) return;
    if (mediaState.state === 'playing') {
      pause(player.getCurrentTimeMs());
    } else {
      play(player.getCurrentTimeMs());
    }
  }

  function handleSeekCommit(ms: number) {
    seek(ms);
    seekingRef.current = false;
  }

  function handleLoadMedia(mode: 'now' | 'queue') {
    if (!form.title || !form.sourceUrl) return;
    const track: TrackInfo = {
      id: crypto.randomUUID(),
      mediaType: form.mediaType,
      title: form.title,
      subtitle: form.subtitle || undefined,
      artworkUrl: form.artworkUrl || undefined,
      sourceUrl: form.sourceUrl,
      durationMs: 0,
      provider: form.provider,
    };
    if (mode === 'queue' && mediaState.track) {
      addToQueue(track);
    } else {
      changeTrack(track, 0, true);
    }
    setShowLoader(false);
    setForm(EMPTY_FORM);
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm text-white/40">Room {roomCode}</p>
          <h1 className="text-2xl font-semibold tracking-tight">Now Playing</h1>
        </div>
        <SyncHealthBadge connected={connected} latencyMs={syncHealth.latencyMs} quality={syncHealth.quality} />
      </header>

      {/* Camera on the left, player in the middle, queue on the right (desktop).
          On smaller screens these stack: player first, then queue, then camera. */}
      <div className="grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)_320px] xl:items-start">
        <aside className="order-3 xl:order-1">
          <CameraPanel memberNames={memberNames} />
        </aside>

        <div className="order-1 space-y-6 xl:order-2">
      <GlassCard hoverable={false} className="overflow-hidden p-0">
        {/* The persistent player positions itself over this rectangle. */}
        <PlayerSlot className={mediaState.track ? 'aspect-video w-full' : 'hidden'} />

        {!mediaState.track && (
          <div className="flex justify-center p-5">
            <button className="btn-secondary text-xs" onClick={() => setShowLoader(true)}>
              Load media
            </button>
          </div>
        )}

        {mediaState.track && (
          <div className="p-5">
            <p className="truncate font-semibold">{mediaState.track.title}</p>
            <p className="truncate text-sm text-white/40">{mediaState.track.subtitle}</p>

            <div className="mt-4">
              <SeekBar
                positionMs={localPositionMs}
                durationMs={durationMs}
                onSeekStart={() => (seekingRef.current = true)}
                onSeekCommit={handleSeekCommit}
              />
              <div className="mt-1 flex justify-between text-xs text-white/40">
                <span>{formatTime(localPositionMs)}</span>
                <span>{durationMs ? formatTime(durationMs) : '--:--'}</span>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-center gap-4">
              <button className="btn-icon" onClick={() => seek(Math.max(0, localPositionMs - 10000))} aria-label="Back 10s">
                <BackIcon />
              </button>
              <button className="btn-primary h-16 w-16 rounded-full" onClick={handleTogglePlay} aria-label="Play/Pause">
                {mediaState.state === 'playing' ? <PauseIcon /> : <PlayIcon />}
              </button>
              <button className="btn-icon" onClick={() => seek(localPositionMs + 10000)} aria-label="Forward 10s">
                <FwdIcon />
              </button>
              <button
                className="btn-icon disabled:opacity-30"
                onClick={skip}
                disabled={mediaState.queue.length === 0}
                aria-label="Next in queue"
                title={mediaState.queue.length ? 'Play next in queue' : 'Queue is empty'}
              >
                <SkipIcon />
              </button>
            </div>

            <div className="mt-5 flex items-center justify-center gap-2">
              {[0.5, 1, 1.25, 1.5, 2].map((rate) => (
                <button
                  key={rate}
                  onClick={() => changeSpeed(rate)}
                  className={`rounded-full px-3 py-1 text-xs ${
                    mediaState.playbackRate === rate ? 'bg-accent text-white' : 'bg-white/5 text-white/50 hover:bg-white/10'
                  }`}
                >
                  {rate}x
                </button>
              ))}
            </div>
          </div>
        )}
      </GlassCard>

          {mediaState.track && (
            <div className="flex gap-4">
              <button className="text-sm text-white/40 hover:text-white/70" onClick={() => setShowLoader(true)}>
                + Add / change media
              </button>
            </div>
          )}

          <ScreenSharePanel otherDeviceIds={otherDeviceIds} />
        </div>

        <aside className="order-2 xl:order-3">
          <GlassCard hoverable={false}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white/70">Up Next ({mediaState.queue.length})</h3>
              <div className="flex items-center gap-3">
                {mediaState.queue.length > 0 && (
                  <button className="text-xs text-accent-soft hover:text-accent" onClick={skip}>
                    Skip →
                  </button>
                )}
                <button
                  className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-white transition hover:bg-accent-soft"
                  onClick={() => setShowLoader(true)}
                >
                  + Add
                </button>
              </div>
            </div>

            {mediaState.queue.length === 0 ? (
              <p className="text-xs text-white/30">
                Queue is empty. Tap <span className="text-white/50">+ Add</span> to line up songs — they play automatically
                one after another.
              </p>
            ) : (
              <div className="space-y-2">
                {mediaState.queue.map((t, i) => (
                  <div key={t.id} className="flex items-center gap-3 rounded-xl bg-white/[0.03] p-2">
                    <span className="w-5 text-center text-xs text-white/30">{i + 1}</span>
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/5">
                      {t.artworkUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={t.artworkUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span>{t.mediaType === 'music' ? '🎵' : '🎬'}</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{t.title}</p>
                      <p className="truncate text-xs text-white/40">
                        {t.subtitle ?? (t.provider === 'youtube' ? 'YouTube' : 'Direct')}
                      </p>
                    </div>
                    <button
                      className="px-2 text-white/30 hover:text-red-400"
                      onClick={() => removeFromQueue(t.id)}
                      aria-label="Remove from queue"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        </aside>
      </div>

      {showLoader && (
        <MediaLoaderModal
          form={form}
          setForm={setForm}
          hasCurrent={!!mediaState.track}
          onClose={() => setShowLoader(false)}
          onSubmit={handleLoadMedia}
        />
      )}

      <GlassCard hoverable={false}>
        <h3 className="mb-3 text-sm font-semibold text-white/70">Sync Health</h3>
        <div className="grid grid-cols-3 gap-3 text-center">
          <Stat label="Latency" value={`${syncHealth.latencyMs}ms`} />
          <Stat label="Clock offset" value={`${syncHealth.clockOffsetMs}ms`} />
          <Stat label="Quality" value={syncHealth.quality} />
        </div>
      </GlassCard>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-lg font-semibold capitalize">{value}</p>
      <p className="text-xs text-white/40">{label}</p>
    </div>
  );
}

function SyncHealthBadge({ connected, latencyMs, quality }: { connected: boolean; latencyMs: number; quality: string }) {
  const color = !connected ? 'bg-red-500' : quality === 'excellent' || quality === 'good' ? 'bg-mint' : 'bg-amber-400';
  return (
    <div className="glass flex items-center gap-2 rounded-full px-3 py-1.5 text-xs">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      {connected ? `${latencyMs}ms` : 'Offline'}
    </div>
  );
}

function SeekBar({
  positionMs,
  durationMs,
  onSeekStart,
  onSeekCommit,
}: {
  positionMs: number;
  durationMs: number;
  onSeekStart: () => void;
  onSeekCommit: (ms: number) => void;
}) {
  const max = durationMs || Math.max(positionMs, 1);
  const [dragValue, setDragValue] = useState<number | null>(null);
  const value = dragValue ?? positionMs;

  return (
    <input
      type="range"
      min={0}
      max={max}
      value={Math.min(value, max)}
      onPointerDown={onSeekStart}
      onChange={(e) => setDragValue(Number(e.target.value))}
      onPointerUp={() => {
        if (dragValue !== null) onSeekCommit(dragValue);
        setDragValue(null);
      }}
      className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-accent"
    />
  );
}

function MediaLoaderModal({
  form,
  setForm,
  hasCurrent,
  onClose,
  onSubmit,
}: {
  form: LoaderForm;
  setForm: (f: LoaderForm) => void;
  hasCurrent: boolean;
  onClose: () => void;
  onSubmit: (mode: 'now' | 'queue') => void;
}) {
  const [lookingUp, setLookingUp] = useState(false);

  async function handleYoutubeUrlChange(value: string) {
    setForm({ ...form, sourceUrl: value });
    const videoId = extractYouTubeId(value);
    if (!videoId) return;

    setLookingUp(true);
    const meta = await fetchYouTubeOEmbed(videoId);
    setLookingUp(false);
    if (meta) {
      setForm({
        ...form,
        sourceUrl: videoId,
        title: form.title || meta.title,
        subtitle: form.subtitle || meta.authorName,
        artworkUrl: meta.thumbnailUrl,
      });
    } else {
      setForm({ ...form, sourceUrl: videoId });
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 md:items-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="glass-card w-full max-w-sm p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-4 font-semibold">Load media</h3>

        <div className="mb-4 grid grid-cols-2 gap-2">
          <button
            className={`rounded-xl px-3 py-2 text-sm ${form.provider === 'direct' ? 'bg-accent text-white' : 'bg-white/5 text-white/60'}`}
            onClick={() => setForm({ ...EMPTY_FORM, mediaType: form.mediaType, provider: 'direct' })}
          >
            Direct URL
          </button>
          <button
            className={`rounded-xl px-3 py-2 text-sm ${form.provider === 'youtube' ? 'bg-accent text-white' : 'bg-white/5 text-white/60'}`}
            onClick={() => setForm({ ...EMPTY_FORM, provider: 'youtube' })}
          >
            YouTube
          </button>
        </div>

        <div className="space-y-3">
          {form.provider === 'direct' && (
            <select
              className="input-field"
              value={form.mediaType}
              onChange={(e) => setForm({ ...form, mediaType: e.target.value as MediaType })}
            >
              <option value="music">Music</option>
              <option value="video">Video</option>
              <option value="movie">Movie</option>
            </select>
          )}

          {form.provider === 'youtube' ? (
            <input
              className="input-field"
              placeholder="Paste a YouTube link…"
              defaultValue=""
              onChange={(e) => handleYoutubeUrlChange(e.target.value)}
              autoFocus
            />
          ) : (
            <input
              className="input-field"
              placeholder="Direct media URL (.mp3, .mp4, .m3u8…)"
              value={form.sourceUrl}
              onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })}
              autoFocus
            />
          )}

          {lookingUp && <p className="text-xs text-white/30">Looking up video info…</p>}

          <input
            className="input-field"
            placeholder="Title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <input
            className="input-field"
            placeholder="Artist / subtitle (optional)"
            value={form.subtitle}
            onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
          />

          <p className="text-xs text-white/30">
            {form.provider === 'youtube'
              ? "Played via YouTube's official embedded player — ads may show as they normally would on YouTube."
              : 'Only direct, self-hosted or licensed media URLs are supported here.'}{' '}
            Orbit never bypasses DRM or controls third-party apps directly.
          </p>
        </div>
        <div className="mt-5 space-y-2">
          <button
            className="btn-primary w-full"
            onClick={() => onSubmit('now')}
            disabled={!form.title || !form.sourceUrl}
          >
            Play now
          </button>
          {hasCurrent && (
            <button
              className="btn-secondary w-full"
              onClick={() => onSubmit('queue')}
              disabled={!form.title || !form.sourceUrl}
            >
              Add to queue
            </button>
          )}
          <button className="w-full py-2 text-center text-sm text-white/40 hover:text-white/70" onClick={onClose}>
            Cancel
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function PlayIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
      <path d="M8 5v14l11-7-11-7Z" />
    </svg>
  );
}
function PauseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  );
}
function BackIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={1.8}>
      <path d="M11 19 3 12l8-7M21 19l-8-7 8-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function FwdIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={1.8}>
      <path d="M13 19l8-7-8-7M3 19l8-7-8-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function SkipIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
      <path d="M6 5l9 7-9 7V5zM17 5h2v14h-2z" />
    </svg>
  );
}
