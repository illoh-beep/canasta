import { isBlackThree, isNatural, isWild, JOKER, sumValues } from '../engine/cards';
import { applyAction, canTakePileAtAll } from '../engine/game';
import { CANASTA_SIZE, hasMelded, initialMeldMinimum, isPileFrozenFor, MAX_WILDS, teamOf, topDiscard } from '../engine/rules';
import type { Action, Card, GameState, MeldGroup, TeamState } from '../engine/types';
import { PROFILES, type Profile } from './difficulty';
import { recall } from './memory';

export type Rand = () => number;

/** Wählt die nächste Aktion für den Bot am Zug. Jede gelieferte Aktion ist legal. */
export function chooseAction(s: GameState, rand: Rand = Math.random): Action {
  const pi = s.current;
  const prof = PROFILES[s.players[pi].difficulty];
  const a = s.phase === 'draw' ? chooseDraw(s, pi, prof, rand) : choosePlay(s, pi, prof, rand);
  if (legal(s, a)) return a;
  // Rückfall: irgendeine legale Aktion.
  if (s.phase === 'draw') return { type: 'drawStock' };
  for (const c of s.players[pi].hand) {
    const d: Action = { type: 'discard', cardId: c.id };
    if (legal(s, d)) return d;
  }
  return a;
}

function legal(s: GameState, a: Action): boolean {
  return applyAction(s, a).ok;
}

const ids = (cards: Card[]) => cards.map((c) => c.id);

function naturalsByRank(cards: Card[]): Map<number, Card[]> {
  const m = new Map<number, Card[]>();
  for (const c of cards) {
    if (!isNatural(c) || c.rank === 3) continue;
    m.set(c.rank, [...(m.get(c.rank) ?? []), c]);
  }
  return m;
}

/** Wildcards, billige (2er) zuerst – oder Joker zuerst, wenn es um Punkte geht. */
function wildsOf(cards: Card[], jokersFirst = false): Card[] {
  return cards
    .filter(isWild)
    .sort((a, b) => (jokersFirst ? Number(b.rank === JOKER) - Number(a.rank === JOKER) : Number(a.rank === JOKER) - Number(b.rank === JOKER)));
}

/** Sucht Meldungen aus der Hand, die zusammen mit `preValue` den Mindestwert erreichen. */
function initialPlan(hand: Card[], min: number, preValue: number): MeldGroup[] | null {
  const groups: Card[][] = [...naturalsByRank(hand).values()]
    .filter((g) => g.length >= 3)
    .sort((a, b) => sumValues(b) - sumValues(a));
  let value = preValue + groups.reduce((s, g) => s + sumValues(g), 0);
  const wilds = wildsOf(hand, true);
  const pairs = [...naturalsByRank(hand).values()].filter((g) => g.length === 2).sort((a, b) => sumValues(b) - sumValues(a));
  while (value < min && wilds.length > 0) {
    const w = wilds.shift()!;
    const pair = pairs.shift();
    if (pair) {
      groups.push([...pair, w]);
      value += sumValues(pair) + sumValues([w]);
      continue;
    }
    const target = groups.find((g) => g.filter(isWild).length < Math.min(MAX_WILDS, g.length - g.filter(isWild).length - 1));
    if (!target) break;
    target.push(w);
    value += sumValues([w]);
  }
  if (value < min || groups.length === 0) return preValue >= min ? [] : null;
  return groups.map((g) => ({ cardIds: ids(g) }));
}

// ---------------------------------------------------------------- Ziehen

function chooseDraw(s: GameState, pi: number, prof: Profile, rand: Rand): Action {
  if (canTakePileAtAll(s) && rand() >= prof.missPile) {
    for (const a of takeCandidates(s, pi, prof)) if (legal(s, a)) return a;
  }
  return { type: 'drawStock' };
}

function takeCandidates(s: GameState, pi: number, prof: Profile): Action[] {
  const top = topDiscard(s)!;
  const hand = s.players[pi].hand;
  const team = teamOf(s, pi);
  const frozen = isPileFrozenFor(s, pi);
  const pileSize = s.discard.length;
  const nats = hand.filter((c) => isNatural(c) && c.rank === top.rank);
  const wilds = wildsOf(hand);
  const out: Action[] = [];

  if (!frozen && team.melds.some((m) => m.rank === top.rank) && pileSize >= prof.minPile[s.mode] - 1) {
    out.push({ type: 'takePile', withCards: [] });
  }
  if (nats.length >= 2 && pileSize >= prof.minPile[s.mode] - (hasMelded(team) ? 0 : 1)) {
    if (hasMelded(team)) {
      out.push({ type: 'takePile', withCards: ids(nats) });
    } else {
      const rest = hand.filter((c) => !nats.includes(c));
      const extras = initialPlan(rest, initialMeldMinimum(team.score), sumValues([top, ...nats]));
      if (extras) out.push({ type: 'takePile', withCards: ids(nats), extraMelds: extras });
    }
  }
  if (!frozen && nats.length === 1 && wilds.length > 0 && pileSize >= prof.minPileForWild[s.mode]) {
    out.push({ type: 'takePile', withCards: [nats[0].id, wilds[0].id] });
  }
  return out;
}

// ---------------------------------------------------------------- Auslegen

function choosePlay(s: GameState, pi: number, prof: Profile, rand: Rand): Action {
  const team = teamOf(s, pi);
  const hand = s.players[pi].hand;

  const out = goOutAction(s, pi);
  if (out) return out;

  if (!hasMelded(team)) {
    const groups = initialPlan(hand, initialMeldMinimum(team.score), 0);
    if (groups && groups.length > 0) {
      const a: Action = { type: 'meld', groups };
      if (legal(s, a)) return a;
    }
    return { type: 'discard', cardId: chooseDiscard(s, pi, prof, rand) };
  }

  const tryMeld = (groups: MeldGroup[]): Action | null => {
    const a: Action = { type: 'meld', groups };
    return groups.length > 0 && legal(s, a) ? a : null;
  };

  // An eigene Meldungen anlegen.
  if (rand() >= prof.missLayoff) {
    const byRank = naturalsByRank(hand);
    const layoffs = team.melds.filter((m) => byRank.has(m.rank)).map((m) => ({ cardIds: ids(byRank.get(m.rank)!), target: m.rank }));
    const all = tryMeld(layoffs);
    if (all) return all;
    for (const g of layoffs) {
      const one = tryMeld([g]);
      if (one) return one;
    }
  }

  // Neue natürliche Meldungen.
  for (const g of naturalsByRank(hand).values()) {
    if (g.length >= 3 && !team.melds.some((m) => m.rank === g[0].rank) && !(hand.length <= (prof.holdTriples[s.mode] ?? -1))) {
      const a = tryMeld([{ cardIds: ids(g) }]);
      if (a) return a;
    }
  }

  // Wildcards einsetzen.
  const wilds = wildsOf(hand);
  if (wilds.length > 0) {
    if (prof.wastesWilds) {
      if (rand() < 0.5) {
        const open = team.melds.filter((m) => m.rank !== 3 && m.cards.filter(isWild).length < MAX_WILDS);
        const m = open[Math.floor(rand() * open.length)];
        const a = m && tryMeld([{ cardIds: [wilds[0].id], target: m.rank }]);
        if (a) return a;
      }
    } else {
      const a = completeCanastaWithWilds(team, wilds, tryMeld);
      if (a) return a;
    }
  }

  // Paare mit Wildcard melden (schwache Bots sofort, starke nur bei voller Hand).
  if (wilds.length > 0 && (prof.dumpsPairs || hand.length >= 12)) {
    for (const g of naturalsByRank(hand).values()) {
      if (g.length === 2 && !team.melds.some((m) => m.rank === g[0].rank)) {
        const a = tryMeld([{ cardIds: [...ids(g), wilds[0].id] }]);
        if (a) return a;
      }
    }
  }

  return { type: 'discard', cardId: chooseDiscard(s, pi, prof, rand) };
}

function completeCanastaWithWilds(team: TeamState, wilds: Card[], tryMeld: (g: MeldGroup[]) => Action | null): Action | null {
  const candidates = team.melds
    .filter((m) => m.rank !== 3 && m.cards.length < CANASTA_SIZE)
    .sort((a, b) => b.cards.length - a.cards.length);
  for (const m of candidates) {
    const need = CANASTA_SIZE - m.cards.length;
    const room = MAX_WILDS - m.cards.filter(isWild).length;
    if (need <= Math.min(room, wilds.length)) {
      const a = tryMeld([{ cardIds: ids(wilds.slice(0, need)), target: m.rank }]);
      if (a) return a;
    }
  }
  return null;
}

/** Versucht, die ganze Hand (bis auf höchstens eine Abwurfkarte) in einer Aktion zu melden. */
function goOutAction(s: GameState, pi: number): Action | null {
  const team = teamOf(s, pi);
  const hand = s.players[pi].hand;
  if (hand.length <= 1) return null;
  const groups: MeldGroup[] = [];
  const wildCount = new Map<number, number>(team.melds.map((m) => [m.rank, m.cards.filter(isWild).length]));
  const natCount = new Map<number, number>(team.melds.map((m) => [m.rank, m.cards.length - m.cards.filter(isWild).length]));
  let leftover: Card[] = [];
  const wilds = wildsOf(hand);

  for (const [rank, g] of naturalsByRank(hand)) {
    if (natCount.has(rank)) {
      groups.push({ cardIds: ids(g), target: rank });
      natCount.set(rank, natCount.get(rank)! + g.length);
    } else if (g.length >= 3) {
      groups.push({ cardIds: ids(g) });
      natCount.set(rank, g.length);
      wildCount.set(rank, 0);
    } else if (g.length === 2 && wilds.length > 0) {
      groups.push({ cardIds: [...ids(g), wilds.shift()!.id] });
      natCount.set(rank, 2);
      wildCount.set(rank, 1);
    } else {
      leftover.push(...g);
    }
  }
  const blacks = hand.filter(isBlackThree);
  if (blacks.length >= 3) groups.push({ cardIds: ids(blacks) });
  else leftover.push(...blacks);

  // Übrige Wildcards auf Meldungen verteilen.
  for (const w of wilds) {
    const rank = [...wildCount.keys()].find((r) => r !== 3 && wildCount.get(r)! < MAX_WILDS);
    if (rank === undefined) {
      leftover.push(w);
      continue;
    }
    wildCount.set(rank, wildCount.get(rank)! + 1);
    const g = groups.find((x) => (x.target ?? cardRank(hand, x)) === rank);
    if (g) g.cardIds.push(w.id);
    else groups.push({ cardIds: [w.id], target: rank });
  }

  if (leftover.length > 1 || groups.length === 0) return null;
  const a: Action = { type: 'meld', groups };
  return legal(s, a) ? a : null;
}

function cardRank(hand: Card[], g: MeldGroup): number | undefined {
  return hand.find((c) => g.cardIds.includes(c.id) && isNatural(c))?.rank;
}

// ---------------------------------------------------------------- Abwerfen

/** Hypergeometrisch: Wahrscheinlichkeit, mit `draws` Karten aus `total` mindestens `need` von `hits` Treffern zu haben. */
function atLeast(need: number, hits: number, draws: number, total: number): number {
  if (need <= 0) return 1;
  if (hits < need || draws < need || total <= 0) return 0;
  let below = 0;
  for (let k = 0; k < need; k++) below += choose(hits, k) * choose(total - hits, draws - k);
  return Math.max(0, 1 - below / choose(total, draws));
}

function choose(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
}

function chooseDiscard(s: GameState, pi: number, prof: Profile, rand: Rand): number {
  const hand = s.players[pi].hand;
  if (hand.length === 1) return hand[0].id;

  if (rand() < prof.discardMistake) {
    const pool = hand.filter((c) => !isWild(c));
    const pick = (pool.length > 0 ? pool : hand)[Math.floor(rand() * (pool.length > 0 ? pool.length : hand.length))];
    return pick.id;
  }

  const n = s.players.length;
  const np = (pi + 1) % n;
  const npTeam = teamOf(s, np);
  const ownTeam = teamOf(s, pi);
  const frozenForNp = s.pileFrozen || !hasMelded(npTeam);
  const pileSize = s.discard.length + 1;
  const mem = recall(s, prof.memory);

  const handCount = new Map<number, number>();
  for (const c of hand) if (isNatural(c)) handCount.set(c.rank, (handCount.get(c.rank) ?? 0) + 1);
  const visible = new Map<number, number>();
  const see = (c: Card) => isNatural(c) && visible.set(c.rank, (visible.get(c.rank) ?? 0) + 1);
  hand.forEach(see);
  s.discard.forEach(see);
  s.teams.forEach((t) => t.melds.forEach((m) => m.cards.forEach(see)));
  const unseenTotal = s.stock.length + s.players.reduce((sum, p, i) => sum + (i === pi ? 0 : p.hand.length), 0);

  const cost = (c: Card): number => {
    if (isWild(c)) {
      if (prof.freezes && !s.pileFrozen && pileSize >= 8 && hasMelded(npTeam)) return 40;
      return 300;
    }
    if (isBlackThree(c)) return prof.safeDiscards ? -100 : 0;
    const count = handCount.get(c.rank) ?? 0;
    let keep = count >= 2 ? 40 + 15 * count : 0;
    if (ownTeam.melds.some((m) => m.rank === c.rank)) keep += 50;
    let danger = 0;
    if (prof.countsCards[s.mode]) {
      const usable = !frozenForNp && npTeam.melds.some((m) => m.rank === c.rank);
      const knownNp = (mem.known.get(np) ?? []).filter((k) => isNatural(k) && k.rank === c.rank).length;
      const need = Math.max(0, (frozenForNp ? 2 : 1) - knownNp);
      const unseenRank = Math.max(0, 8 - (visible.get(c.rank) ?? 0) - knownNp);
      const npUnknown = Math.max(0, s.players[np].hand.length - (mem.known.get(np)?.length ?? 0));
      const p = usable ? 1 : atLeast(need, unseenRank, npUnknown, unseenTotal);
      danger = p * (30 + pileSize * 10);
    } else if (prof.safeDiscards) {
      if (!frozenForNp && npTeam.melds.some((m) => m.rank === c.rank)) danger += 60 + pileSize * 6;
      const knownNp = (mem.known.get(np) ?? []).filter((k) => isNatural(k) && k.rank === c.rank).length;
      if (knownNp >= 2) danger += 50 + pileSize * 5;
      else if (knownNp === 1 && !frozenForNp) danger += 25 + pileSize * 2;
      if (mem.discardedRanks.get(np)?.has(c.rank)) danger -= 15;
      if (8 - (visible.get(c.rank) ?? 0) <= 1) danger -= 20;
    }
    return keep + danger - sumValues([c]) * 0.1;
  };

  let best = hand[0];
  let bestCost = Infinity;
  for (const c of hand) {
    const k = cost(c);
    if (k < bestCost) {
      best = c;
      bestCost = k;
    }
  }
  return best.id;
}
