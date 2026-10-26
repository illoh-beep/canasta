import type { Card, GameState } from '../engine/types';

export interface Memory {
  /** Karten, von denen bekannt ist, dass sie ein Spieler auf der Hand hat (aus aufgenommenen Stapeln). */
  known: Map<number, Card[]>;
  /** Ränge, die ein Spieler zuletzt abgeworfen hat. */
  discardedRanks: Map<number, Set<number>>;
}

/** Was sich ein Bot mit begrenztem Gedächtnis aus den öffentlichen Ereignissen der Runde merken kann. */
export function recall(s: GameState, window: number): Memory {
  const events = window === Infinity ? s.events : window <= 0 ? [] : s.events.slice(-window);
  const known = new Map<number, Map<number, Card>>();
  const discardedRanks = new Map<number, Set<number>>();
  for (const e of events) {
    const k = known.get(e.player) ?? new Map<number, Card>();
    known.set(e.player, k);
    if (e.kind === 'takePile') for (const c of e.cards) k.set(c.id, c);
    if (e.kind === 'meld') for (const c of e.cards) k.delete(c.id);
    if (e.kind === 'discard') {
      k.delete(e.card.id);
      const d = discardedRanks.get(e.player) ?? new Set<number>();
      d.add(e.card.rank);
      discardedRanks.set(e.player, d);
    }
  }
  return {
    known: new Map([...known].map(([p, m]) => [p, [...m.values()]])),
    discardedRanks,
  };
}
