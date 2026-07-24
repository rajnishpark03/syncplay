'use client';

import { useState } from 'react';
import { GAME_CATALOG, GameId, GamePlayer } from '@orbit/shared';
import { GlassCard } from '@/components/ui/glass-card';
import { RoomGate } from '@/components/room/room-gate';
import { ChessBoard, ChessState, chessStatus, createInitialChessState } from '@/components/games/chess-board';
import { LudoBoard } from '@/components/games/ludo-board';
import {
  LudoState,
  applyMove,
  createInitialLudoState,
  legalTokens,
  nextSeat,
  rollDie,
  tokensHome,
} from '@/lib/games/ludo-logic';
import { useGame } from '@/hooks/use-game';
import { useSyncEngine } from '@/hooks/use-sync-engine';

export default function GamesPage() {
  return (
    <RoomGate>
      <GamesSection />
    </RoomGate>
  );
}

function GamesSection() {
  const { members, deviceId } = useSyncEngine();
  const { session, mySeat, isMyTurn, startGame, sendMove, endGame } = useGame();

  function handleStart(gameId: GameId) {
    // Everyone currently in the room gets a seat, in a stable order.
    const ordered = [...members].sort((a, b) => a.deviceId.localeCompare(b.deviceId));
    const players: GamePlayer[] = ordered.map((m, i) => ({ deviceId: m.deviceId, name: m.deviceName, seat: i }));
    if (players.length < 2) return;

    if (gameId === 'chess') {
      startGame('chess', players.slice(0, 2), createInitialChessState(), 0);
    } else {
      const seats = players.map((p) => p.seat);
      startGame('ludo', players, createInitialLudoState(seats), 0);
    }
  }

  if (!session) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <header>
          <p className="text-sm text-white/40">Play together</p>
          <h1 className="text-2xl font-semibold tracking-tight">Games</h1>
        </header>

        {members.length < 2 && (
          <GlassCard hoverable={false}>
            <p className="text-sm text-white/50">
              Waiting for someone else to join your room — games need at least 2 players.
            </p>
          </GlassCard>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {GAME_CATALOG.map((game) => (
            <GlassCard key={game.id} hoverable={false} className="flex flex-col gap-3">
              <span className="text-3xl">{game.emoji}</span>
              <div>
                <h3 className="font-semibold">{game.name}</h3>
                <p className="text-xs text-white/40">{game.description}</p>
                <p className="mt-1 text-xs text-white/30">
                  {game.minPlayers}
                  {game.maxPlayers > game.minPlayers ? `–${game.maxPlayers}` : ''} players
                </p>
              </div>
              <button
                className="btn-primary mt-auto text-sm"
                onClick={() => handleStart(game.id)}
                disabled={members.length < game.minPlayers}
              >
                Start {game.name}
              </button>
            </GlassCard>
          ))}
        </div>

        <p className="text-xs text-white/30">
          Music keeps playing while you play — everything runs at the same time.
        </p>
      </div>
    );
  }

  const turnPlayer = session.players.find((p) => p.seat === session.turnSeat);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm text-white/40">Room {session.roomCode}</p>
          <h1 className="text-2xl font-semibold tracking-tight capitalize">{session.gameId}</h1>
        </div>
        <button className="btn-secondary text-xs" onClick={endGame}>
          End game
        </button>
      </header>

      {session.gameId === 'chess' ? (
        <ChessSection
          state={session.state as ChessState}
          mySeat={mySeat}
          isMyTurn={isMyTurn}
          finished={session.finished}
          turnName={turnPlayer?.name ?? '—'}
          onMove={(next, finished) => sendMove(next, finished ? session.turnSeat : session.turnSeat === 0 ? 1 : 0, finished)}
        />
      ) : (
        <LudoSection
          state={session.state as LudoState}
          mySeat={mySeat}
          isMyTurn={isMyTurn}
          finished={session.finished}
          turnSeat={session.turnSeat}
          turnName={turnPlayer?.name ?? '—'}
          onSend={sendMove}
        />
      )}

      <GlassCard hoverable={false}>
        <h3 className="mb-2 text-sm font-semibold text-white/70">Players</h3>
        <div className="space-y-1.5">
          {session.players.map((p) => (
            <div key={p.deviceId} className="flex items-center justify-between text-sm">
              <span className={p.seat === session.turnSeat ? 'text-white' : 'text-white/50'}>
                {p.name} {p.deviceId === deviceId && <span className="text-white/30">(you)</span>}
              </span>
              {p.seat === session.turnSeat && !session.finished && (
                <span className="rounded-full bg-accent/20 px-2 py-0.5 text-xs text-accent-soft">their turn</span>
              )}
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}

function ChessSection({
  state,
  mySeat,
  isMyTurn,
  finished,
  turnName,
  onMove,
}: {
  state: ChessState;
  mySeat: number | null;
  isMyTurn: boolean;
  finished: boolean;
  turnName: string;
  onMove: (next: ChessState, finished: boolean) => void;
}) {
  const status = chessStatus(state.fen);

  return (
    <div className="space-y-3">
      <GlassCard hoverable={false} className="py-3 text-center">
        <p className="text-sm">
          {finished ? status.text : isMyTurn ? 'Your move' : `Waiting for ${turnName}`}
        </p>
        {!finished && status.text.includes('check') && <p className="text-xs text-amber-300">{status.text}</p>}
        <p className="mt-1 text-xs text-white/40">You are {mySeat === 1 ? 'Black' : 'White'}</p>
      </GlassCard>
      <ChessBoard state={state} mySeat={mySeat} isMyTurn={isMyTurn && !finished} onMove={onMove} />
    </div>
  );
}

function LudoSection({
  state,
  mySeat,
  isMyTurn,
  finished,
  turnSeat,
  turnName,
  onSend,
}: {
  state: LudoState;
  mySeat: number | null;
  isMyTurn: boolean;
  finished: boolean;
  turnSeat: number;
  turnName: string;
  onSend: (state: unknown, turnSeat: number, finished?: boolean) => void;
}) {
  const [rolling, setRolling] = useState(false);
  const dice = state.dice;

  function handleRoll() {
    if (!isMyTurn || dice !== null || mySeat === null) return;
    setRolling(true);
    // Brief suspense, then commit the roll to the shared state.
    setTimeout(() => {
      const value = rollDie();
      const moves = legalTokens(state, mySeat, value);

      if (moves.length === 0) {
        // Nothing playable — pass the turn (a 6 still earns another try).
        const passTo = value === 6 ? turnSeat : nextSeat(state, turnSeat);
        onSend({ ...state, dice: null, lastMessage: `Rolled ${value} — no moves` }, passTo, false);
      } else {
        onSend({ ...state, dice: value, lastMessage: undefined }, turnSeat, false);
      }
      setRolling(false);
    }, 350);
  }

  function handlePickToken(tokenIndex: number) {
    if (!isMyTurn || dice === null || mySeat === null) return;
    const result = applyMove(state, mySeat, tokenIndex, dice);
    const won = result.state.winnerSeat !== undefined;
    const passTo = won || result.extraTurn ? turnSeat : nextSeat(state, turnSeat);
    onSend(result.state, passTo, won);
  }

  const myPlayer = state.players.find((p) => p.seat === mySeat);

  return (
    <div className="space-y-3">
      <GlassCard hoverable={false} className="flex items-center justify-between py-3">
        <div>
          <p className="text-sm">
            {finished
              ? `🏆 ${state.winnerSeat === mySeat ? 'You win!' : `${turnName} wins!`}`
              : isMyTurn
                ? dice === null
                  ? 'Your turn — roll the dice'
                  : 'Pick a token to move'
                : `Waiting for ${turnName}`}
          </p>
          {state.lastMessage && <p className="text-xs text-white/40">{state.lastMessage}</p>}
          {myPlayer && <p className="text-xs text-white/30">{tokensHome(myPlayer)}/4 of your tokens home</p>}
        </div>

        <button
          onClick={handleRoll}
          disabled={!isMyTurn || dice !== null || finished || rolling}
          className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-2xl font-bold text-base-900 transition disabled:opacity-30"
          aria-label="Roll dice"
        >
          {rolling ? '🎲' : (dice ?? '🎲')}
        </button>
      </GlassCard>

      <LudoBoard state={state} mySeat={mySeat} isMyTurn={isMyTurn && !finished} dice={dice} onPickToken={handlePickToken} />

      <p className="text-center text-xs text-white/30">
        Roll a 6 to bring a token out. Land on someone to send them home. Exact roll to finish. Star squares are safe.
      </p>
    </div>
  );
}
