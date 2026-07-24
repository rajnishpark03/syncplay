/**
 * Full Ludo rules engine.
 *
 * Board model: the classic 15x15 layout — a shared 52-square ring, plus a
 * private 5-square home column per colour leading to the centre.
 *
 * A token's `progress` is relative to its own colour:
 *   -1        → still in base
 *   0 .. 50   → on the shared ring (absolute square = (start + progress) % 52)
 *   51 .. 55  → home column
 *   56        → home (finished)
 * You need an exact roll to land on 56, which is the standard rule.
 */

export const RING_SIZE = 52;
export const HOME_COLUMN_START = 51;
export const FINISH = 56;

/** Where each colour joins the ring. */
export const COLOUR_START = [0, 13, 26, 39];

/** Ring squares nobody can be captured on: the four entry squares + four stars. */
export const SAFE_SQUARES = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

export const COLOURS = ['red', 'green', 'yellow', 'blue'] as const;
export type LudoColour = (typeof COLOURS)[number];

export interface LudoPlayer {
  seat: number;
  /** 0=red, 1=green, 2=yellow, 3=blue. */
  colour: number;
  tokens: number[]; // 4 progress values
}

export interface LudoState {
  players: LudoPlayer[];
  /** Last roll, or null when it's time to roll. */
  dice: number | null;
  /** Set when a roll produced no legal move, so the UI can explain the skip. */
  lastMessage?: string;
  winnerSeat?: number;
}

/** 2 players sit opposite each other (red/yellow); 3–4 fill in order. */
export function coloursForPlayerCount(count: number): number[] {
  if (count <= 2) return [0, 2];
  if (count === 3) return [0, 1, 2];
  return [0, 1, 2, 3];
}

export function createInitialLudoState(seats: number[]): LudoState {
  const colours = coloursForPlayerCount(seats.length);
  return {
    players: seats.map((seat, i) => ({ seat, colour: colours[i], tokens: [-1, -1, -1, -1] })),
    dice: null,
  };
}

export function rollDie(): number {
  return 1 + Math.floor(Math.random() * 6);
}

/** Absolute ring square for a token, or null if it's in base / the home column. */
export function ringSquare(colour: number, progress: number): number | null {
  if (progress < 0 || progress > 50) return null;
  return (COLOUR_START[colour] + progress) % RING_SIZE;
}

/** Indices of tokens that may legally move with this roll. */
export function legalTokens(state: LudoState, seat: number, dice: number): number[] {
  const player = state.players.find((p) => p.seat === seat);
  if (!player) return [];

  return player.tokens.reduce<number[]>((acc, progress, index) => {
    if (progress === FINISH) return acc; // already home
    if (progress === -1) {
      if (dice === 6) acc.push(index); // a 6 releases a token from base
      return acc;
    }
    if (progress + dice <= FINISH) acc.push(index); // exact roll needed to finish
    return acc;
  }, []);
}

export interface MoveResult {
  state: LudoState;
  /** Same player rolls again after a 6, a capture, or sending a token home. */
  extraTurn: boolean;
  captured: boolean;
  finishedToken: boolean;
}

export function applyMove(state: LudoState, seat: number, tokenIndex: number, dice: number): MoveResult {
  const next: LudoState = JSON.parse(JSON.stringify(state));
  const player = next.players.find((p) => p.seat === seat)!;
  const from = player.tokens[tokenIndex];
  const to = from === -1 ? 0 : from + dice;

  player.tokens[tokenIndex] = to;

  // Capture: any opponent token sharing this ring square goes back to base,
  // unless the square is one of the protected ones.
  let captured = false;
  const landedSquare = ringSquare(player.colour, to);
  if (landedSquare !== null && !SAFE_SQUARES.has(landedSquare)) {
    for (const other of next.players) {
      if (other.seat === seat) continue;
      other.tokens = other.tokens.map((p) => {
        if (ringSquare(other.colour, p) === landedSquare) {
          captured = true;
          return -1;
        }
        return p;
      });
    }
  }

  const finishedToken = to === FINISH;
  if (player.tokens.every((p) => p === FINISH)) next.winnerSeat = seat;

  next.dice = null;
  next.lastMessage = undefined;

  return { state: next, extraTurn: dice === 6 || captured || finishedToken, captured, finishedToken };
}

/** Seat that plays after `seat`, in seating order. */
export function nextSeat(state: LudoState, seat: number): number {
  const seats = state.players.map((p) => p.seat).sort((a, b) => a - b);
  const i = seats.indexOf(seat);
  return seats[(i + 1) % seats.length];
}

export function tokensHome(player: LudoPlayer): number {
  return player.tokens.filter((p) => p === FINISH).length;
}
