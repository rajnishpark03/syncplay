'use client';

import { useRoomStore } from '@/lib/room-store';

/**
 * A hand-drawn couple sketch behind the whole app, different for every room.
 *
 * The variant and palette are derived from the room code, not random per
 * device — otherwise each partner would see a different backdrop for the same
 * room. Same code in, same artwork out, on every device and every reload.
 */

const PALETTES = [
  { name: 'rose', from: '#ff5c8a', to: '#ffb37a', wash: 'rgba(255,92,138,0.16)' },
  { name: 'violet', from: '#a78bfa', to: '#ff86a9', wash: 'rgba(167,139,250,0.15)' },
  { name: 'amber', from: '#ffb37a', to: '#ff7a9c', wash: 'rgba(255,179,122,0.14)' },
  { name: 'teal', from: '#4ee6a8', to: '#7ac0ff', wash: 'rgba(78,230,168,0.12)' },
  { name: 'sunset', from: '#ff8f6b', to: '#c86dd7', wash: 'rgba(200,109,215,0.14)' },
  { name: 'blush', from: '#ff9ec4', to: '#ffd9a0', wash: 'rgba(255,158,196,0.15)' },
];

/** Stable 32-bit hash so the same room code always resolves to the same art. */
function hashCode(code: string): number {
  let h = 2166136261;
  for (let i = 0; i < code.length; i++) {
    h ^= code.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** Two figures sitting close under a crescent moon. */
function MoonlitSketch(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 400 300" fill="none" {...props}>
      <path d="M318 62a30 30 0 1 1-26-29 24 24 0 0 0 26 29Z" strokeWidth="2" />
      <circle cx="86" cy="52" r="2" /><circle cx="130" cy="34" r="1.6" /><circle cx="262" cy="106" r="1.6" />
      <circle cx="52" cy="104" r="1.4" /><circle cx="350" cy="132" r="1.6" />
      <path d="M120 250c0-30 14-48 34-48s32 18 32 48" strokeWidth="2" strokeLinecap="round" />
      <circle cx="154" cy="176" r="18" strokeWidth="2" />
      <path d="M188 250c0-34 15-54 36-54s34 20 34 54" strokeWidth="2" strokeLinecap="round" />
      <circle cx="224" cy="168" r="20" strokeWidth="2" />
      <path d="M172 214c14-8 30-8 44 0" strokeWidth="2" strokeLinecap="round" />
      <path d="M60 250h280" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** Two profiles facing each other, a heart in the space between. */
function ProfilesSketch(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 400 300" fill="none" {...props}>
      <path
        d="M150 250V196c-18-8-28-28-28-52 0-32 20-54 46-54"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path d="M168 90c10 10 12 24 6 34-5 9-5 18 2 24" strokeWidth="2" strokeLinecap="round" />
      <path d="M250 250V196c18-8 28-28 28-52 0-32-20-54-46-54" strokeWidth="2" strokeLinecap="round" />
      <path d="M232 90c-10 10-12 24-6 34 5 9 5 18-2 24" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M200 152c-6-8-18-8-22 0-4 7 0 14 22 28 22-14 26-21 22-28-4-8-16-8-22 0Z"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M70 250h260" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** Holding hands, walking. */
function HandsSketch(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 400 300" fill="none" {...props}>
      <circle cx="140" cy="96" r="19" strokeWidth="2" />
      <path d="M140 115v66M140 181l-16 62M140 181l16 62M140 132l-32 22M140 132l46 26" strokeWidth="2" strokeLinecap="round" />
      <circle cx="262" cy="90" r="21" strokeWidth="2" />
      <path d="M262 111v70M262 181l-18 62M262 181l18 62M262 132l-46 26M262 132l34 24" strokeWidth="2" strokeLinecap="round" />
      <circle cx="200" cy="160" r="5" strokeWidth="2" />
      <path d="M196 140c-4-5-11-5-13 0-3 4 0 8 13 16 13-8 16-12 13-16-2-5-9-5-13 0Z" strokeWidth="1.6" />
      <path d="M60 249h280" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** Two figures on a balcony rail, city lights beyond. */
function BalconySketch(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 400 300" fill="none" {...props}>
      <path d="M40 214h320M70 214v46M330 214v46M120 214v46M180 214v46M240 214v46M300 214v46" strokeWidth="2" strokeLinecap="round" />
      <circle cx="168" cy="122" r="17" strokeWidth="2" />
      <path d="M168 139v52M168 158l-26 16M168 158l30 14" strokeWidth="2" strokeLinecap="round" />
      <circle cx="232" cy="116" r="19" strokeWidth="2" />
      <path d="M232 135v56M232 156l-30 14M232 156l28 18" strokeWidth="2" strokeLinecap="round" />
      <path d="M60 60h30M78 44v32" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="316" cy="60" r="2" /><circle cx="340" cy="86" r="1.6" /><circle cx="290" cy="40" r="1.6" />
    </svg>
  );
}

/** Sharing headphones. */
function HeadphonesSketch(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 400 300" fill="none" {...props}>
      <circle cx="150" cy="132" r="26" strokeWidth="2" />
      <circle cx="250" cy="132" r="26" strokeWidth="2" />
      <path d="M150 158v38c0 20 14 34 34 34h32c20 0 34-14 34-34v-38" strokeWidth="2" strokeLinecap="round" />
      <path d="M124 128a76 76 0 0 1 152 0" strokeWidth="2" strokeLinecap="round" />
      <rect x="112" y="120" width="16" height="34" rx="8" strokeWidth="2" />
      <rect x="272" y="120" width="16" height="34" rx="8" strokeWidth="2" />
      <path d="M200 196c-5-7-15-7-19 0-3 6 1 12 19 24 18-12 22-18 19-24-4-7-14-7-19 0Z" strokeWidth="1.8" />
      <path d="M92 92l8-14 8 14M300 82l7-12 7 12" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

const SKETCHES = [MoonlitSketch, ProfilesSketch, HandsSketch, BalconySketch, HeadphonesSketch];

export function RoomBackdrop() {
  const currentRoom = useRoomStore((s) => s.currentRoom);
  const seed = hashCode(currentRoom?.code ?? 'ORBIT');
  const palette = PALETTES[seed % PALETTES.length];
  const Sketch = SKETCHES[Math.floor(seed / PALETTES.length) % SKETCHES.length];
  const gradientId = `orbit-backdrop-${palette.name}`;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* Colour wash keyed to this room */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(70% 55% at 12% 0%, ${palette.wash}, transparent 62%),
                       radial-gradient(60% 45% at 100% 8%, ${palette.wash}, transparent 60%),
                       radial-gradient(55% 50% at 50% 110%, ${palette.wash}, transparent 65%)`,
        }}
      />
      {/* Gradient lives in its own SVG; the sketch references it by id, which
          is valid across SVG elements in the same document and keeps each
          sketch component a plain drawing with no plumbing. */}
      <svg width="0" height="0" className="absolute">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={palette.from} />
            <stop offset="100%" stopColor={palette.to} />
          </linearGradient>
        </defs>
      </svg>

      {/* The couple sketch — big, low-contrast, bottom-right so it never fights text */}
      <Sketch
        className="absolute -bottom-6 -right-8 h-[62vh] w-auto opacity-[0.14] sm:-right-4 sm:h-[70vh]"
        stroke={`url(#${gradientId})`}
        fill="none"
      />
    </div>
  );
}
