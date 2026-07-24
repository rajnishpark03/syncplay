'use client';

import { useMemo, useState } from 'react';
import { Chess, Square } from 'chess.js';

/** Serialised chess state we sync between devices — FEN is all that's needed. */
export interface ChessState {
  fen: string;
  lastMove?: { from: string; to: string };
}

export function createInitialChessState(): ChessState {
  return { fen: new Chess().fen() };
}

const PIECES: Record<string, string> = {
  wp: '♙', wn: '♘', wb: '♗', wr: '♖', wq: '♕', wk: '♔',
  bp: '♟', bn: '♞', bb: '♝', br: '♜', bq: '♛', bk: '♚',
};

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

export function chessStatus(fen: string): { text: string; finished: boolean } {
  const game = new Chess(fen);
  if (game.isCheckmate()) return { text: `Checkmate — ${game.turn() === 'w' ? 'Black' : 'White'} wins!`, finished: true };
  if (game.isStalemate()) return { text: 'Stalemate — draw', finished: true };
  if (game.isDraw()) return { text: 'Draw', finished: true };
  if (game.isCheck()) return { text: `${game.turn() === 'w' ? 'White' : 'Black'} is in check`, finished: false };
  return { text: `${game.turn() === 'w' ? 'White' : 'Black'} to move`, finished: false };
}

interface Props {
  state: ChessState;
  /** 0 = white, 1 = black. Board flips for black so your pieces are nearest. */
  mySeat: number | null;
  isMyTurn: boolean;
  onMove: (next: ChessState, finished: boolean) => void;
}

export function ChessBoard({ state, mySeat, isMyTurn, onMove }: Props) {
  const [selected, setSelected] = useState<Square | null>(null);
  const game = useMemo(() => new Chess(state.fen), [state.fen]);
  const flipped = mySeat === 1;

  const legalTargets = useMemo(() => {
    if (!selected) return new Set<string>();
    return new Set(game.moves({ square: selected, verbose: true }).map((m) => m.to));
  }, [game, selected]);

  // Rank 8 → 1 for white; reversed for black so each player sees their own side.
  const ranks = flipped ? [1, 2, 3, 4, 5, 6, 7, 8] : [8, 7, 6, 5, 4, 3, 2, 1];
  const files = flipped ? [...FILES].reverse() : FILES;

  function handleSquare(square: Square) {
    if (!isMyTurn) return;

    const piece = game.get(square);
    const myColour = mySeat === 1 ? 'b' : 'w';

    // Selecting / re-selecting one of your own pieces.
    if (piece && piece.color === myColour) {
      setSelected(square === selected ? null : square);
      return;
    }

    if (!selected) return;

    try {
      // Always promote to a queen — the overwhelmingly common choice, and it
      // keeps the mobile flow to a single tap.
      const move = game.move({ from: selected, to: square, promotion: 'q' });
      if (!move) return;
      const next: ChessState = { fen: game.fen(), lastMove: { from: move.from, to: move.to } };
      onMove(next, chessStatus(next.fen).finished);
      setSelected(null);
    } catch {
      setSelected(null); // illegal move — just clear the selection
    }
  }

  return (
    <div className="mx-auto w-full max-w-[min(97vw,560px)]">
      <div className="grid aspect-square w-full grid-cols-8 overflow-hidden rounded-2xl ring-1 ring-white/10">
        {ranks.map((rank) =>
          files.map((file) => {
            const square = `${file}${rank}` as Square;
            const piece = game.get(square);
            const dark = (FILES.indexOf(file) + rank) % 2 === 0;
            const isSelected = selected === square;
            const isTarget = legalTargets.has(square);
            const isLast = state.lastMove && (state.lastMove.from === square || state.lastMove.to === square);

            return (
              <button
                key={square}
                onClick={() => handleSquare(square)}
                className={`relative flex items-center justify-center transition-colors ${
                  dark ? 'bg-[#6d4370]' : 'bg-[#f0dbe8]'
                } ${isSelected ? 'ring-2 ring-inset ring-accent' : ''} ${isLast ? 'brightness-110' : ''}`}
                aria-label={square}
              >
                {piece && (
                  <span
                    className={`select-none leading-none ${
                      piece.color === 'w' ? 'text-white' : 'text-[#1a1016]'
                    }`}
                    style={{ fontSize: 'clamp(22px, 7.4vw, 42px)', textShadow: '0 1px 2px rgba(0,0,0,.35)' }}
                  >
                    {PIECES[`${piece.color}${piece.type}`]}
                  </span>
                )}
                {isTarget && !piece && <span className="absolute h-1/4 w-1/4 rounded-full bg-accent/70" />}
                {isTarget && piece && <span className="absolute inset-0 ring-4 ring-inset ring-accent/70" />}
              </button>
            );
          }),
        )}
      </div>
    </div>
  );
}
