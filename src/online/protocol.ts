import type { Action, Card, Difficulty, GameState, Mode } from '../engine/types';

/** Präfix für PeerJS-IDs, damit unsere Codes nicht mit anderen Apps kollidieren. */
const PEER_PREFIX = 'canasta-fg-v1-';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function newRoomCode(): string {
  let code = '';
  for (let i = 0; i < 5; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return code;
}

export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
}

export function peerId(code: string): string {
  return PEER_PREFIX + code;
}

export function joinLink(code: string): string {
  return `${location.origin}${location.pathname}?join=${code}`;
}

export type SeatKind = 'host' | 'guest' | 'bot';

export interface LobbySeat {
  kind: SeatKind;
  name: string;
}

export interface LobbyInfo {
  code: string;
  mode: Mode;
  difficulty: Difficulty;
  targetScore: number;
  seats: LobbySeat[];
  /** Verbundene Gäste ohne Platz. */
  waiting: string[];
}

export type HostMessage =
  | { t: 'lobby'; lobby: LobbyInfo; seat: number | null }
  | { t: 'state'; view: GameState }
  | { t: 'result'; id: number; error: string | null }
  | { t: 'closed'; reason: string };

export type GuestMessage = { t: 'hello'; name: string } | { t: 'action'; id: number; action: Action };

const hidden = (n: number, base: number): Card[] => Array.from({ length: n }, (_, i) => ({ id: base - i, rank: 0, suit: null }));

/**
 * Sicht eines Platzes auf das Spiel: Der Spieler sitzt in der Ansicht auf Platz 0 und heißt "Du".
 * Fremde Handkarten und der Stock werden durch Platzhalter ersetzt, damit niemand schummeln kann.
 */
export function makeView(s: GameState, seat: number, redact = true): GameState {
  const n = s.players.length;
  const idx = (i: number) => (i - seat + n) % n;
  const v: GameState = structuredClone(s);
  v.players = s.players.map((_, i) => structuredClone(s.players[(i + seat) % n]));
  v.players.forEach((p, i) => {
    if (i === 0) {
      p.name = 'Du';
      p.isHuman = true;
    } else if (redact) {
      p.hand = hidden(p.hand.length, -1000 * (i + 1));
    }
  });
  if (redact) {
    v.stock = hidden(s.stock.length, -100000);
    v.rng = 0;
  }
  v.current = idx(s.current);
  v.dealer = idx(s.dealer);
  const fixRound = (r: GameState['lastRound']) => (r && r.wentOut !== null ? { ...r, wentOut: idx(r.wentOut) } : r);
  v.lastRound = fixRound(s.lastRound);
  v.history = s.history.map((r) => fixRound(r)!);
  v.events = s.events.map((e) => ({ ...e, player: idx(e.player) }));
  return v;
}
