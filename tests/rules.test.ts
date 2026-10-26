import { describe, expect, it } from 'vitest';
import { applyAction, newGame } from '../src/engine/game';
import { createDeck } from '../src/engine/cards';
import { initialMeldMinimum } from '../src/engine/rules';
import type { Action, Card, GameState, Suit } from '../src/engine/types';

let nextId = 1000;
const c = (rank: number, suit: Suit | null = 'S'): Card => ({ id: nextId++, rank, suit: rank === 0 ? null : suit });
const joker = () => c(0, null);
const many = (rank: number, n: number, suit: Suit = 'S') => Array.from({ length: n }, () => c(rank, suit));
const filler = (n: number) => Array.from({ length: n }, (_, i) => c(4 + (i % 9), 'C'));

/** Spielstand mit festgelegter Hand, Stapel und Stock für Spieler 0. */
function setup(opts: {
  mode?: 2 | 4;
  hand: Card[];
  discard?: Card[];
  stock?: Card[];
  phase?: 'draw' | 'play';
  frozen?: boolean;
  melds?: { rank: number; cards: Card[] }[];
  oppMelds?: { rank: number; cards: Card[] }[];
  score?: number;
}): GameState {
  const s = newGame({ mode: opts.mode ?? 4, difficulty: 'easy', seed: 1 });
  s.current = 0;
  s.players.forEach((p, i) => (p.hand = i === 0 ? opts.hand : filler(11)));
  s.discard = opts.discard ?? [c(9, 'H')];
  s.stock = opts.stock ?? filler(30);
  s.pileFrozen = opts.frozen ?? false;
  s.teams[0].melds = opts.melds ?? [];
  s.teams[1].melds = opts.oppMelds ?? [];
  s.teams[0].redThrees = [];
  s.teams[1].redThrees = [];
  s.teams[0].score = opts.score ?? 0;
  s.phase = opts.phase ?? 'play';
  s.turnStartTeamMelded = s.teams[0].melds.length > 0;
  s.turnStartAnyoneMelded = s.teams.some((t) => t.melds.length > 0);
  return s;
}

function act(s: GameState, a: Action) {
  const r = applyAction(s, a);
  if (!r.ok) throw new Error(r.error);
  return r.state;
}
function err(s: GameState, a: Action) {
  const r = applyAction(s, a);
  expect(r.ok).toBe(false);
  return r.ok ? '' : r.error;
}
const ids = (cards: Card[]) => cards.map((x) => x.id);

describe('Deck und Geben', () => {
  it('hat 108 Karten mit 4 Jokern', () => {
    const d = createDeck();
    expect(d.length).toBe(108);
    expect(d.filter((x) => x.rank === 0).length).toBe(4);
  });

  it('gibt 11 Karten bei 4 Spielern und 15 bei 2 Spielern, rote Dreien liegen aus', () => {
    for (const mode of [4, 2] as const) {
      const s = newGame({ mode, difficulty: 'easy', seed: 42 });
      for (const p of s.players) {
        expect(p.hand.length).toBe(mode === 4 ? 11 : 15);
        expect(p.hand.some((x) => x.rank === 3 && (x.suit === 'H' || x.suit === 'D'))).toBe(false);
      }
      const total =
        s.players.reduce((n, p) => n + p.hand.length, 0) +
        s.stock.length +
        s.discard.length +
        s.teams.reduce((n, t) => n + t.redThrees.length, 0);
      expect(total).toBe(108);
    }
  });

  it('Startkarte ist nie Wildcard oder rote 3 oben', () => {
    for (let seed = 0; seed < 200; seed++) {
      const s = newGame({ mode: 4, difficulty: 'easy', seed });
      const top = s.discard[s.discard.length - 1];
      expect(top.rank === 0 || top.rank === 2).toBe(false);
      expect(top.rank === 3 && (top.suit === 'H' || top.suit === 'D')).toBe(false);
      if (s.discard.length > 1) expect(s.pileFrozen).toBe(true);
    }
  });
});

describe('Erstmeldung', () => {
  it('Mindestwerte nach Punktestand', () => {
    expect(initialMeldMinimum(-10)).toBe(30);
    expect(initialMeldMinimum(0)).toBe(50);
    expect(initialMeldMinimum(1495)).toBe(50);
    expect(initialMeldMinimum(1500)).toBe(90);
    expect(initialMeldMinimum(3000)).toBe(120);
  });

  it('lehnt zu wenige Punkte ab und akzeptiert mehrere Meldungen zusammen', () => {
    const kings = many(13, 3);
    const aces = many(14, 2);
    const s = setup({ hand: [...kings, ...aces, joker(), c(5), c(6)] });
    expect(err(s, { type: 'meld', groups: [{ cardIds: ids(kings) }] })).toMatch(/50 Punkte/);
    const ok = act(s, { type: 'meld', groups: [{ cardIds: ids(kings) }, { cardIds: [...ids(aces), s.players[0].hand[5].id] }] });
    expect(ok.teams[0].melds.length).toBe(2);
  });

  it('bei negativem Stand reichen 30 Punkte', () => {
    const kings = many(13, 3);
    const s = setup({ hand: [...kings, c(5), c(6)], score: -200 });
    expect(act(s, { type: 'meld', groups: [{ cardIds: ids(kings) }] }).teams[0].melds.length).toBe(1);
  });
});

describe('Meldungen', () => {
  it('braucht 2 natürliche Karten und höchstens 3 Wildcards', () => {
    const s = setup({ hand: [c(9), joker(), joker(), c(5), c(6)], melds: [{ rank: 13, cards: many(13, 3) }] });
    expect(err(s, { type: 'meld', groups: [{ cardIds: ids(s.players[0].hand.slice(0, 3)) }] })).toMatch(/natürliche/);
    const s2 = setup({
      hand: [joker(), c(5), c(6)],
      melds: [{ rank: 13, cards: [...many(13, 2), joker(), joker(), c(2)] }],
    });
    expect(err(s2, { type: 'meld', groups: [{ cardIds: [s2.players[0].hand[0].id], target: 13 }] })).toMatch(/Wildcards/);
  });

  it('schwarze Dreien nur beim Ausmachen', () => {
    const threes = many(3, 3, 'C');
    const canasta = { rank: 13, cards: many(13, 7) };
    const s = setup({ hand: [...threes, c(5), c(6)], melds: [canasta] });
    expect(err(s, { type: 'meld', groups: [{ cardIds: ids(threes) }] })).toMatch(/Ausmachen/);
    const s2 = setup({ hand: [...threes, c(5)], melds: [canasta] });
    const after = act(s2, { type: 'meld', groups: [{ cardIds: ids(threes) }] });
    expect(after.players[0].hand.length).toBe(1);
  });

  it('kann nicht ohne Canasta auf eine Karte heruntermelden', () => {
    const s = setup({ hand: [c(13), c(13), c(5)], melds: [{ rank: 13, cards: many(13, 3) }] });
    expect(err(s, { type: 'meld', groups: [{ cardIds: ids(s.players[0].hand.slice(0, 2)), target: 13 }] })).toMatch(
      /Canasta/,
    );
  });
});

describe('Ablagestapel', () => {
  it('eingefroren vor der Erstmeldung: braucht natürliches Paar und Mindestwert', () => {
    const top = c(13, 'H');
    const s = setup({ phase: 'draw', hand: [c(13), joker(), c(14), c(14), c(14), c(5)], discard: [c(7), top] });
    expect(err(s, { type: 'takePile', withCards: [s.players[0].hand[0].id, s.players[0].hand[1].id] })).toMatch(/natürliche/);
    const s2 = setup({ phase: 'draw', hand: [c(13), c(13), c(14), c(14), c(14), c(5)], discard: [c(7), top] });
    expect(err(s2, { type: 'takePile', withCards: ids(s2.players[0].hand.slice(0, 2)) })).toMatch(/50 Punkte/);
    const after = act(s2, {
      type: 'takePile',
      withCards: ids(s2.players[0].hand.slice(0, 2)),
      extraMelds: [{ cardIds: ids(s2.players[0].hand.slice(2, 5)) }],
    });
    expect(after.teams[0].melds.length).toBe(2);
    expect(after.players[0].hand.some((x) => x.rank === 7)).toBe(true);
    expect(after.discard.length).toBe(0);
  });

  it('nicht eingefroren: Anlegen an eigene Meldung oder natürlich + Wildcard', () => {
    const melds = [{ rank: 9, cards: many(9, 3) }];
    const s = setup({ phase: 'draw', hand: [c(5), c(6)], discard: [c(4), c(9, 'H')], melds });
    const a = act(s, { type: 'takePile', withCards: [] });
    expect(a.teams[0].melds[0].cards.length).toBe(4);
    const s2 = setup({ phase: 'draw', hand: [c(10), joker(), c(6)], discard: [c(4), c(10, 'H')], melds });
    expect(act(s2, { type: 'takePile', withCards: ids(s2.players[0].hand.slice(0, 2)) }).teams[0].melds.length).toBe(2);
  });

  it('durch Wildcard eingefroren: kein Anlegen erlaubt', () => {
    const melds = [{ rank: 9, cards: many(9, 3) }];
    const s = setup({ phase: 'draw', hand: [c(5), c(6)], discard: [c(2, 'H'), c(9, 'H')], melds, frozen: true });
    expect(err(s, { type: 'takePile', withCards: [] })).toMatch(/eingefroren/);
  });

  it('Wildcard oder schwarze 3 oben blockiert', () => {
    expect(err(setup({ phase: 'draw', hand: [c(3, 'S'), c(3, 'C')], discard: [c(3, 'S')] }), { type: 'takePile', withCards: [] })).toMatch(
      /schwarze 3/,
    );
    expect(err(setup({ phase: 'draw', hand: [c(5)], discard: [joker()] }), { type: 'takePile', withCards: [] })).toMatch(/Wildcard/);
  });

  it('Abwurf einer Wildcard friert den Stapel ein', () => {
    const s = setup({ hand: [c(2, 'H'), c(5), c(6)] });
    expect(act(s, { type: 'discard', cardId: s.players[0].hand[0].id }).pileFrozen).toBe(true);
  });
});

describe('Rote Dreien', () => {
  it('werden beim Ziehen ausgelegt und ersetzt', () => {
    const red = c(3, 'H');
    const s = setup({ phase: 'draw', hand: [c(5), c(6)], stock: [c(8), red] });
    const a = act(s, { type: 'drawStock' });
    expect(a.teams[0].redThrees.length).toBe(1);
    expect(a.players[0].hand.length).toBe(3);
  });
});

describe('Wertung', () => {
  const canasta = () => ({ rank: 13, cards: many(13, 7) });

  it('normales Ausmachen: 100 Bonus, rote 3 positiv mit Canasta', () => {
    const s = setup({ hand: [c(5)], melds: [canasta()] });
    s.teams[0].redThrees = [c(3, 'H')];
    s.teams[1].redThrees = [c(3, 'D')];
    const a = act(s, { type: 'discard', cardId: s.players[0].hand[0].id });
    const t0 = a.lastRound!.teams[0];
    expect(a.lastRound!.goOutKind).toBe('normal');
    expect(t0.goOutBonus).toBe(100);
    expect(t0.canastaBonus).toBe(500);
    expect(t0.meldPoints).toBe(70);
    expect(t0.redThreeBonus).toBe(100);
    // Gegner haben keinen Canasta → rote 3 zählt minus.
    expect(a.lastRound!.teams[1].redThreeBonus).toBe(-100);
  });

  it('vier rote Dreien zählen 800', () => {
    const s = setup({ hand: [c(5)], melds: [canasta()] });
    s.teams[0].redThrees = [c(3, 'H'), c(3, 'H'), c(3, 'D'), c(3, 'D')];
    const a = act(s, { type: 'discard', cardId: s.players[0].hand[0].id });
    expect(a.lastRound!.teams[0].redThreeBonus).toBe(800);
  });

  it('gemischter Canasta 300, Handkarten minus', () => {
    const s = setup({ hand: [c(5)], melds: [{ rank: 13, cards: [...many(13, 5), joker(), c(2)] }] });
    s.players[1].hand = [joker(), c(14)];
    s.players[3].hand = [c(5)];
    const a = act(s, { type: 'discard', cardId: s.players[0].hand[0].id });
    expect(a.lastRound!.teams[0].canastaBonus).toBe(300);
    expect(a.lastRound!.teams[1].handPenalty).toBe(75);
  });

  it('Handcanasta: 1000 Bonus, wenn noch niemand ausgelegt hat', () => {
    const kings = many(13, 7);
    const s = setup({ hand: [...kings, ...many(14, 3), c(5)] });
    const a = act(s, { type: 'meld', groups: [{ cardIds: ids(kings) }, { cardIds: ids(s.players[0].hand.slice(7, 10)) }] });
    const b = act(a, { type: 'discard', cardId: a.players[0].hand[0].id });
    expect(b.lastRound!.goOutKind).toBe('handcanasta');
    expect(b.lastRound!.teams[0].goOutBonus).toBe(1000);
  });

  it('verdeckt ausmachen: 200, wenn nur der Gegner schon lag', () => {
    const kings = many(13, 7);
    const s = setup({ hand: [...kings, c(5)], oppMelds: [{ rank: 9, cards: many(9, 3) }] });
    const a = act(s, { type: 'meld', groups: [{ cardIds: ids(kings) }] });
    const b = act(a, { type: 'discard', cardId: a.players[0].hand[0].id });
    expect(b.lastRound!.goOutKind).toBe('concealed');
    expect(b.lastRound!.teams[0].goOutBonus).toBe(200);
  });

  it('2 Spieler: ein Canasta reicht zum Ausmachen, es wird 1 Karte gezogen', () => {
    const s = setup({ mode: 2, hand: [c(5)], melds: [canasta()] });
    expect(act(s, { type: 'discard', cardId: s.players[0].hand[0].id }).phase).toBe('roundOver');
    const d = setup({ mode: 2, phase: 'draw', hand: [c(5)] });
    expect(act(d, { type: 'drawStock' }).players[0].hand.length).toBe(2);
  });

  it('leerer Stock beendet die Runde ohne Ausmach-Bonus', () => {
    const s = setup({ phase: 'draw', hand: [c(5), c(6)], stock: [] });
    const a = act(s, { type: 'drawStock' });
    expect(a.phase).toBe('roundOver');
    expect(a.lastRound!.wentOut).toBeNull();
  });
});
