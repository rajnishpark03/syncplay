'use client';

import { useCallback, useEffect, useState } from 'react';
import { ClientEvents, GameId, GamePlayer, GameSession, ServerEvents } from '@orbit/shared';
import { getSocket } from '@/lib/socket';
import { getOrCreateDeviceId } from '@/lib/device';

/**
 * Room-scoped multiplayer game sync.
 *
 * The server only stores the opaque state and enforces turn order, so this
 * hook is the same for every game — a new game plugs in via the client-side
 * registry without touching the backend.
 */
export function useGame() {
  const [session, setSession] = useState<GameSession | null>(null);
  const deviceId = getOrCreateDeviceId();

  useEffect(() => {
    const socket = getSocket();
    const onState = (next: GameSession | null) => setSession(next);
    socket.on(ServerEvents.GAME_STATE, onState);
    if (socket.connected) socket.emit(ClientEvents.GAME_REQUEST_STATE);
    const onConnect = () => socket.emit(ClientEvents.GAME_REQUEST_STATE);
    socket.on('connect', onConnect);
    return () => {
      socket.off(ServerEvents.GAME_STATE, onState);
      socket.off('connect', onConnect);
    };
  }, []);

  const startGame = useCallback((gameId: GameId, players: GamePlayer[], state: unknown, turnSeat = 0) => {
    getSocket().emit(ClientEvents.GAME_START, { deviceId, gameId, players, state, turnSeat });
  }, [deviceId]);

  const sendMove = useCallback((state: unknown, turnSeat: number, finished = false) => {
    getSocket().emit(ClientEvents.GAME_MOVE, { deviceId, state, turnSeat, finished });
  }, [deviceId]);

  const endGame = useCallback(() => {
    getSocket().emit(ClientEvents.GAME_END, { deviceId });
  }, [deviceId]);

  const mySeat = session?.players.find((p) => p.deviceId === deviceId)?.seat ?? null;
  const isMyTurn = session !== null && mySeat !== null && session.turnSeat === mySeat && !session.finished;

  return { session, deviceId, mySeat, isMyTurn, startGame, sendMove, endGame };
}
