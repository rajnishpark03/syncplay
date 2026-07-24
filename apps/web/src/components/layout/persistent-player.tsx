'use client';

import { MediaPlayer } from '@/components/sync/media-player';
import { usePlayer } from '@/providers/player-provider';
import { useSyncEngine } from '@/hooks/use-sync-engine';

/**
 * The single, never-unmounted media surface.
 *
 * It's `position: fixed` and simply moves/resizes to wherever the current
 * screen wants it (the Sync screen publishes a slot rectangle). Because the
 * element itself is never re-parented or remounted, audio/video keeps playing
 * while you browse to Games, Home, Settings, etc.
 */
export function PersistentPlayer() {
  const { playerRef, slot, setMediaDurationMs } = usePlayer();
  const { mediaState, reportEnded } = useSyncEngine();

  const track = mediaState.track;
  const isVideo = track?.mediaType !== 'music';

  // Nothing loaded → don't render a stray box anywhere.
  if (!track) return null;

  const inSlot = slot !== null;

  const style: React.CSSProperties = inSlot
    ? { top: slot!.top, left: slot!.left, width: slot!.width, height: slot!.height }
    : {};

  return (
    <div
      className={
        inSlot
          ? 'fixed z-30 overflow-hidden rounded-2xl'
          : // Mini player: small, out of the way, still playing.
            'fixed bottom-24 left-3 z-30 w-32 overflow-hidden rounded-xl shadow-card ring-1 ring-white/10 sm:w-40 md:bottom-6 md:left-24 md:w-52'
      }
      style={style}
    >
      <MediaPlayer
        ref={playerRef}
        track={track}
        isVideo={isVideo}
        onDurationChange={setMediaDurationMs}
        onEnded={() => reportEnded(track.id)}
      />
      {!inSlot && (
        <div className="bg-base-900/90 px-2 py-1.5">
          <p className="truncate text-[11px] text-white/80">{track.title}</p>
          <p className="truncate text-[10px] text-white/40">{mediaState.state === 'playing' ? 'Playing' : 'Paused'}</p>
        </div>
      )}
    </div>
  );
}
