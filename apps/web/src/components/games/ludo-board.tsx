'use client';

import {
  COLOURS,
  FINISH,
  LudoState,
  SAFE_SQUARES,
  legalTokens,
  ringSquare,
} from '@/lib/games/ludo-logic';

/**
 * The 52 ring squares as [row, col] on a 15x15 board, clockwise, starting at
 * red's entry square. Index 0/13/26/39 are the four colours' entry points.
 */
const RING: Array<[number, number]> = [
  [6, 1], [6, 2], [6, 3], [6, 4], [6, 5],
  [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6],
  [0, 7],
  [0, 8], [1, 8], [2, 8], [3, 8], [4, 8], [5, 8],
  [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14],
  [7, 14],
  [8, 14], [8, 13], [8, 12], [8, 11], [8, 10], [8, 9],
  [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8],
  [14, 7],
  [14, 6], [13, 6], [12, 6], [11, 6], [10, 6], [9, 6],
  [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0],
  [7, 0],
  [6, 0],
];

/** Each colour's 5 private home-column squares, from the ring inwards. */
const HOME_COLUMN: Array<Array<[number, number]>> = [
  [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]],
  [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],
  [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]],
  [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]],
];

/** Parking spots inside each colour's 6x6 base. */
const BASE_SPOTS: Array<Array<[number, number]>> = [
  [[1, 1], [1, 4], [4, 1], [4, 4]],
  [[1, 10], [1, 13], [4, 10], [4, 13]],
  [[10, 10], [10, 13], [13, 10], [13, 13]],
  [[10, 1], [10, 4], [13, 1], [13, 4]],
];

/** The 6x6 base blocks: [startRow, startCol]. */
const BASE_ORIGIN: Array<[number, number]> = [
  [0, 0],
  [0, 9],
  [9, 9],
  [9, 0],
];

const COLOUR_CLASS = ['bg-rose-500', 'bg-emerald-500', 'bg-amber-400', 'bg-sky-500'];
const COLOUR_SOFT = ['bg-rose-500/25', 'bg-emerald-500/25', 'bg-amber-400/25', 'bg-sky-500/25'];

interface Props {
  state: LudoState;
  mySeat: number | null;
  isMyTurn: boolean;
  /** null while it's time to roll. */
  dice: number | null;
  onPickToken: (tokenIndex: number) => void;
}

export function LudoBoard({ state, mySeat, isMyTurn, dice, onPickToken }: Props) {
  const movable = mySeat !== null && isMyTurn && dice ? legalTokens(state, mySeat, dice) : [];

  // Where every token currently sits, keyed by "row-col" so we can stack them.
  const occupancy = new Map<string, Array<{ colour: number; seat: number; index: number }>>();
  for (const player of state.players) {
    player.tokens.forEach((progress, index) => {
      let cell: [number, number] | undefined;
      if (progress === -1) cell = BASE_SPOTS[player.colour][index];
      else if (progress === FINISH) cell = [7, 7];
      else if (progress >= 51) cell = HOME_COLUMN[player.colour][progress - 51];
      else {
        const sq = ringSquare(player.colour, progress);
        if (sq !== null) cell = RING[sq];
      }
      if (!cell) return;
      const key = `${cell[0]}-${cell[1]}`;
      const list = occupancy.get(key) ?? [];
      list.push({ colour: player.colour, seat: player.seat, index });
      occupancy.set(key, list);
    });
  }

  const ringLookup = new Map<string, number>();
  RING.forEach(([r, c], i) => ringLookup.set(`${r}-${c}`, i));

  const homeLookup = new Map<string, number>();
  HOME_COLUMN.forEach((cells, colour) => cells.forEach(([r, c]) => homeLookup.set(`${r}-${c}`, colour)));

  const baseOf = (r: number, c: number): number | null => {
    for (let i = 0; i < BASE_ORIGIN.length; i++) {
      const [br, bc] = BASE_ORIGIN[i];
      if (r >= br && r < br + 6 && c >= bc && c < bc + 6) return i;
    }
    return null;
  };

  return (
    <div className="mx-auto w-full max-w-[min(92vw,560px)]">
      <div
        className="grid aspect-square w-full overflow-hidden rounded-2xl bg-base-900 ring-1 ring-white/10"
        style={{ gridTemplateColumns: 'repeat(15, 1fr)', gridTemplateRows: 'repeat(15, 1fr)' }}
      >
        {Array.from({ length: 15 }).map((_, row) =>
          Array.from({ length: 15 }).map((__, col) => {
            const key = `${row}-${col}`;
            const ringIndex = ringLookup.get(key);
            const homeColour = homeLookup.get(key);
            const base = baseOf(row, col);
            const tokens = occupancy.get(key) ?? [];
            const isCentre = row === 7 && col === 7;

            let cls = 'bg-base-850';
            if (base !== null) cls = COLOUR_SOFT[base];
            if (ringIndex !== undefined) {
              cls = 'bg-white/90';
              // Colour each entry square with its owner's colour.
              const entry = [0, 13, 26, 39].indexOf(ringIndex);
              if (entry >= 0) cls = COLOUR_CLASS[entry];
              else if (SAFE_SQUARES.has(ringIndex)) cls = 'bg-white/60';
            }
            if (homeColour !== undefined) cls = COLOUR_CLASS[homeColour];
            if (isCentre) cls = 'bg-gradient-to-br from-accent to-accent-muted';

            return (
              <div key={key} className={`relative ${cls} ring-[0.5px] ring-black/10`}>
                {ringIndex !== undefined && SAFE_SQUARES.has(ringIndex) && tokens.length === 0 && (
                  <span className="absolute inset-0 flex items-center justify-center text-[8px] text-black/40">★</span>
                )}
                {tokens.length > 0 && (
                  <div className="absolute inset-0 flex flex-wrap items-center justify-center gap-[1px] p-[1px]">
                    {tokens.map((t) => {
                      const canMove = t.seat === mySeat && movable.includes(t.index);
                      return (
                        <button
                          key={`${t.seat}-${t.index}`}
                          onClick={() => canMove && onPickToken(t.index)}
                          disabled={!canMove}
                          aria-label={`${COLOURS[t.colour]} token ${t.index + 1}`}
                          className={`rounded-full ${COLOUR_CLASS[t.colour]} ring-1 ring-black/40 ${
                            tokens.length > 1 ? 'h-[42%] w-[42%]' : 'h-[70%] w-[70%]'
                          } ${canMove ? 'animate-pulse ring-2 ring-white' : ''}`}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }),
        )}
      </div>
    </div>
  );
}
