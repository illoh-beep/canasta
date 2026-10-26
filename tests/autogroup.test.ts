import { describe, expect, it } from 'vitest';
import { autoGroup } from '../src/engine/autogroup';
import type { Card, Meld } from '../src/engine/types';

let id = 1;
const c = (rank: number): Card => ({ id: id++, rank, suit: rank === 0 ? null : 'S' });
const groupsOf = (r: ReturnType<typeof autoGroup>, cards: Card[]) => {
  if (typeof r === 'string') throw new Error(r);
  return r.map((g) => g.cardIds.map((x) => cards.find((k) => k.id === x)!.rank).sort((a, b) => a - b));
};

describe('Automatisches Aufteilen der Auswahl', () => {
  it('trennt verschiedene Ränge in eigene Meldungen', () => {
    const cards = [c(13), c(13), c(13), c(9), c(9), c(9)];
    expect(groupsOf(autoGroup(cards, []), cards)).toEqual([
      [13, 13, 13],
      [9, 9, 9],
    ]);
  });

  it('gibt Wildcards an Paare, denen eine Karte fehlt', () => {
    const cards = [c(14), c(14), c(0), c(8), c(8), c(8), c(2)];
    const g = groupsOf(autoGroup(cards, []), cards);
    const aces = g.find((x) => x.includes(14))!;
    expect(aces.filter((r) => r === 0 || r === 2).length).toBeGreaterThanOrEqual(1);
    expect(g.every((x) => x.length >= 3)).toBe(true);
    expect(g.flat().length).toBe(7);
  });

  it('legt einzelne Karten an bestehende Meldungen an', () => {
    const melds: Meld[] = [{ rank: 7, cards: [c(7), c(7), c(7)] }];
    const cards = [c(7), c(10), c(10), c(10)];
    expect(groupsOf(autoGroup(cards, melds), cards)).toEqual([[7], [10, 10, 10]]);
  });

  it('fragt nach, wenn nur Wildcards gewählt sind', () => {
    expect(typeof autoGroup([c(0)], [])).toBe('string');
  });
});
