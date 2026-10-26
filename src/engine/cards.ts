import type { Card, Rank, Suit } from './types';

export const JOKER = 0;
export const ACE = 14;
const SUITS: Suit[] = ['S', 'H', 'D', 'C'];

export function isWild(c: Card): boolean {
  return c.rank === JOKER || c.rank === 2;
}

export function isRed(c: Card): boolean {
  return c.suit === 'H' || c.suit === 'D';
}

export function isRedThree(c: Card): boolean {
  return c.rank === 3 && isRed(c);
}

export function isBlackThree(c: Card): boolean {
  return c.rank === 3 && !isRed(c);
}

export function isNatural(c: Card): boolean {
  return !isWild(c);
}

export function cardValue(c: Card): number {
  if (c.rank === JOKER) return 50;
  if (c.rank === 2 || c.rank === ACE) return 20;
  if (isRedThree(c)) return 100;
  if (c.rank >= 8) return 10;
  return 5;
}

export function sumValues(cards: Card[]): number {
  return cards.reduce((s, c) => s + cardValue(c), 0);
}

/** Zwei Pakete à 52 Karten plus 4 Joker = 108 Karten. */
export function createDeck(): Card[] {
  const deck: Card[] = [];
  let id = 0;
  for (let d = 0; d < 2; d++) {
    for (const suit of SUITS) {
      for (let rank = 2; rank <= ACE; rank++) deck.push({ id: id++, rank, suit });
    }
    deck.push({ id: id++, rank: JOKER, suit: null });
    deck.push({ id: id++, rank: JOKER, suit: null });
  }
  return deck;
}

const RANK_NAMES: Record<number, string> = { 0: 'Joker', 11: 'B', 12: 'D', 13: 'K', 14: 'A' };
const RANK_LONG: Record<number, string> = { 0: 'Joker', 11: 'Buben', 12: 'Damen', 13: 'Könige', 14: 'Asse' };
export const SUIT_SYMBOL: Record<Suit, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };

export function rankLabel(rank: Rank): string {
  return RANK_NAMES[rank] ?? String(rank);
}

export function rankPlural(rank: Rank): string {
  return RANK_LONG[rank] ?? `${rank}er`;
}

export function cardLabel(c: Card): string {
  return c.suit ? `${rankLabel(c.rank)}${SUIT_SYMBOL[c.suit]}` : 'Joker';
}

/** Sortierung für die Handanzeige: Wildcards links, dann absteigend nach Rang. */
export function sortHand(cards: Card[]): Card[] {
  const order = (c: Card) => (c.rank === JOKER ? 100 : c.rank === 2 ? 99 : c.rank);
  const suitOrder: Record<string, number> = { S: 0, H: 1, C: 2, D: 3 };
  return [...cards].sort((a, b) => order(b) - order(a) || suitOrder[a.suit ?? 'S'] - suitOrder[b.suit ?? 'S'] || a.id - b.id);
}

// Deterministischer Zufall (mulberry32), damit Partien reproduzierbar und testbar sind.
export function nextRandom(seed: number): [number, number] {
  let t = (seed + 0x6d2b79f5) | 0;
  const next = t;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, next];
}

export function shuffle<T>(items: T[], seed: number): [T[], number] {
  const arr = [...items];
  let s = seed;
  for (let i = arr.length - 1; i > 0; i--) {
    const [r, ns] = nextRandom(s);
    s = ns;
    const j = Math.floor(r * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return [arr, s];
}
