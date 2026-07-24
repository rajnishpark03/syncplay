'use client';

import { useLayoutEffect, useRef } from 'react';
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

  // Layout effect: measures before the browser paints, so the player is
  // already in place on the first frame instead of visibly jumping there.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    let frame = 0;
    const measure = () => {
      const r = el.getBoundingClientRect();
      // Clamp to the viewport: a transient over-wide measurement would
      // otherwise paint the player past the right edge of a phone screen.
      const maxWidth = document.documentElement.clientWidth;
      const left = Math.max(0, Math.min(r.left, maxWidth));
      setSlot({ top: r.top, left, width: Math.min(r.width, maxWidth - left), height: r.height });
    };
    // Coalesce to one measurement per frame — without this, scrolling on a
    // phone fires far more often than paint and the video visibly jitters.
    const publish = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };

    measure();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    window.addEventListener('scroll', publish, true);
    window.addEventListener('resize', publish);

    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      window.removeEventListener('scroll', publish, true);
      window.removeEventListener('resize', publish);
      // Leaving Sync → player falls back to the mini player, still playing.
      setSlot(null);
    };
  }, [setSlot]);

  return <div ref={ref} className={className ?? 'aspect-video w-full rounded-2xl bg-black/40'} />;
}
