'use client';

import { useEffect, useRef } from 'react';
import { usePlayer } from '@/providers/player-provider';

/**
 * A placeholder the Sync screen renders where the big player should appear.
 * It measures itself and hands the rectangle to the persistent player, which
 * then positions itself on top. Keeps playback uninterrupted while still
 * letting the player look like it's part of the page layout.
 */
export function PlayerSlot({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { setSlot } = usePlayer();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const publish = () => {
      const r = el.getBoundingClientRect();
      setSlot({ top: r.top, left: r.left, width: r.width, height: r.height });
    };

    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    window.addEventListener('scroll', publish, true);
    window.addEventListener('resize', publish);

    return () => {
      ro.disconnect();
      window.removeEventListener('scroll', publish, true);
      window.removeEventListener('resize', publish);
      // Leaving Sync → player falls back to the mini player, still playing.
      setSlot(null);
    };
  }, [setSlot]);

  return <div ref={ref} className={className ?? 'aspect-video w-full rounded-2xl bg-black/40'} />;
}
