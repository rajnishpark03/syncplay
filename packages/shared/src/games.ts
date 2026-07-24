/**
 * Multiplayer games layer.
 *
 * The server is deliberately **game-agnostic**: it stores an opaque `state`
 * blob per room, enforces only "is it your turn", and broadcasts. All rules
 * live in the client game modules. That means adding a new game needs **no
 * backend change at all** — just a new entry in the frontend game registry.
 */

/** Every game a room can play. Add a new id here + a registry entry on the client. */
export type GameId = 'chess' | 'ludo';

export interface GamePlayer {
  deviceId: string;
  name: string;
  /** 0-based seat. Chess: 0=white, 1=black. Ludo: 0..3 = red, green, yellow, blue. */
  seat: number;
}

export interface GameSession {
  roomCode: string;
  gameId: GameId;
  players: GamePlayer[];
  /** Seat whose turn it is. Server only checks this to reject out-of-turn moves. */
  turnSeat: number;
  /** Game-specific state. Opaque to the server. */
  state: unknown;
  /** Set once someone wins / the game is over; keeps the final board on screen. */
  finished: boolean;
  updatedAt: string;
}

export interface GameMeta {
  id: GameId;
  name: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
}

export const GAME_CATALOG: GameMeta[] = [
  {
    id: 'chess',
    name: 'Chess',
    description: 'Full rules — castling, en passant, promotion, checkmate.',
    minPlayers: 2,
    maxPlayers: 2,
  },
  {
    id: 'ludo',
    name: 'Ludo',
    description: 'Roll a six to start, capture, race home.',
    minPlayers: 2,
    maxPlayers: 4,
  },
];

// ---- Client -> Server ----

export interface GameStartPayload {
  deviceId: string;
  gameId: GameId;
  /** Initial state produced by the starting client's game module. */
  state: unknown;
  players: GamePlayer[];
  turnSeat: number;
}

export interface GameMovePayload {
  deviceId: string;
  /** Full next state after the move — simplest correct model for 2–4 players. */
  state: unknown;
  turnSeat: number;
  finished?: boolean;
}

export interface GameEndPayload {
  deviceId: string;
}

// ---- Server -> Client ----

export type GameStatePayload = GameSession | null;
