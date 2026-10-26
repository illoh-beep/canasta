import { isBlackThree, isNatural, isWild, sumValues } from './cards';
import type { Card, GameState, Meld, MeldGroup, Mode, Rank, TeamState } from './types';

export const MAX_WILDS = 3;
export const CANASTA_SIZE = 7;

/** Mindestwert der Erstmeldung nach dem Gesamtstand des Teams. */
export function initialMeldMinimum(score: number): number {
  if (score < 0) return 30;
  if (score < 1500) return 50;
  if (score < 3000) return 90;
  return 120;
}

export function requiredCanastas(mode: Mode): number {
  return mode === 2 ? 2 : 1;
}

export function handSize(mode: Mode): number {
  return mode === 2 ? 15 : 11;
}

export function isCanasta(m: Meld): boolean {
  return m.cards.length >= CANASTA_SIZE;
}

export function isNaturalCanasta(m: Meld): boolean {
  return isCanasta(m) && m.cards.every(isNatural);
}

export function canastaCount(melds: Meld[]): number {
  return melds.filter(isCanasta).length;
}

export function hasMelded(team: TeamState): boolean {
  return team.melds.length > 0;
}

export function teamOf(state: GameState, player: number): TeamState {
  return state.teams[state.players[player].team];
}

export function teamMembers(state: GameState, team: number): number[] {
  return state.players.map((p, i) => (p.team === team ? i : -1)).filter((i) => i >= 0);
}

export function topDiscard(state: GameState): Card | undefined {
  return state.discard[state.discard.length - 1];
}

/** Ist der Stapel für dieses Team eingefroren (nur mit natürlichem Paar aufnehmbar)? */
export function isPileFrozenFor(state: GameState, player: number): boolean {
  return state.pileFrozen || !hasMelded(teamOf(state, player));
}

export interface ResolvedMelds {
  melds: Meld[];
  hand: Card[];
  /** Alle in dieser Aktion neu gelegten Karten. */
  placed: Card[];
  usedBlackThrees: boolean;
}

/**
 * Prüft eine Liste von Meldgruppen gegen die Teamauslage und die Hand.
 * `extra` ist eine Karte von außerhalb der Hand (oberste Stapelkarte), die der ersten Gruppe hinzugefügt wird.
 */
export function resolveGroups(
  melds: Meld[],
  hand: Card[],
  groups: MeldGroup[],
  extra?: Card,
): ResolvedMelds | string {
  const handById = new Map(hand.map((c) => [c.id, c]));
  const used = new Set<number>();
  const newMelds: Meld[] = melds.map((m) => ({ rank: m.rank, cards: [...m.cards] }));
  const placed: Card[] = [];
  let usedBlackThrees = false;

  for (let gi = 0; gi < groups.length; gi++) {
    const g = groups[gi];
    const cards: Card[] = [];
    for (const id of g.cardIds) {
      const c = handById.get(id);
      if (!c) return 'Diese Karte ist nicht auf deiner Hand.';
      if (used.has(id)) return 'Eine Karte wurde doppelt verwendet.';
      used.add(id);
      cards.push(c);
    }
    if (gi === 0 && extra) cards.push(extra);
    if (cards.length === 0) continue;

    const naturals = cards.filter(isNatural);
    const ranks = new Set(naturals.map((c) => c.rank));
    if (ranks.size > 1) return 'Eine Meldung darf nur Karten eines Rangs enthalten.';
    let rank: Rank | undefined = naturals[0]?.rank;
    if (g.target !== undefined) {
      if (rank !== undefined && rank !== g.target) return 'Diese Karten passen nicht zu der Meldung.';
      rank = g.target;
    }
    if (rank === undefined) return 'Wildcards allein ergeben keine Meldung.';

    if (rank === 3) {
      if (!cards.every(isBlackThree)) return 'Schwarze Dreien dürfen nur ohne Wildcards gemeldet werden.';
      usedBlackThrees = true;
    }

    let meld = newMelds.find((m) => m.rank === rank);
    if (!meld) {
      if (g.target !== undefined) return 'Diese Meldung gibt es nicht.';
      meld = { rank, cards: [] };
      newMelds.push(meld);
    }
    meld.cards.push(...cards);
    placed.push(...cards);
  }

  for (const m of newMelds) {
    const wilds = m.cards.filter(isWild).length;
    const nats = m.cards.length - wilds;
    if (m.cards.length < 3) return 'Eine Meldung braucht mindestens 3 Karten.';
    if (nats < 2) return 'Eine Meldung braucht mindestens 2 natürliche Karten.';
    if (wilds > MAX_WILDS) return `Höchstens ${MAX_WILDS} Wildcards pro Meldung.`;
    if (m.rank === 3 && wilds > 0) return 'Schwarze Dreien dürfen nur ohne Wildcards gemeldet werden.';
  }

  return { melds: newMelds, hand: hand.filter((c) => !used.has(c.id)), placed, usedBlackThrees };
}

export function placedValue(r: ResolvedMelds): number {
  return sumValues(r.placed);
}
