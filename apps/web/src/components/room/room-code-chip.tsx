'use client';

import { useState } from 'react';

/**
 * The room code as a compact, tappable chip — one tap copies it so you can
 * paste it straight into a chat. Sized to stay readable on small phones.
 */
export function RoomCodeChip({ code }: { code: string | null }) {
  const [copied, setCopied] = useState(false);

  if (!code) return null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(code!);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // clipboard blocked (insecure context / permissions) — the code is still visible
    }
  }

  return (
    <button
      onClick={copy}
      className="mt-1 inline-flex max-w-full items-center gap-1.5 rounded-full bg-white/[0.06] px-2.5 py-1 text-xs text-white/60 transition hover:bg-white/10 active:scale-95"
      aria-label={`Room code ${code}, tap to copy`}
    >
      <span className="text-white/35">Room</span>
      <span className="font-mono tracking-[0.15em] text-accent-soft">{code}</span>
      <span className="text-white/35">{copied ? '✓' : '⧉'}</span>
    </button>
  );
}
