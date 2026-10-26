import {
  cardLabel,
  cardValue,
  createDeck,
  isBlackThree,
  isNatural,
  isRedThree,
  isWild,
  rankPlural,
  shuffle,
  sumValues,
} from './cards';
import {
  canastaCount,
  handSize,
  hasMelded,
  initialMeldMinimum,
  isCanasta,
  isNaturalCanasta,
  isPileFrozenFor,
  requiredCanastas,
  resolveGroups,
  teamMembers,
  teamOf,
  topDiscard,
} from './rules';
import type {
  Action,
  AvatarConfig,
  Card,
  Difficulty,
  GameState,
  Meld,
  MeldGroup,
  Mode,
  Player,
  Result,
  RoundResult,
  TeamRoundScore,
  TeamState,
} from './types';

export interface NewGameOptions {
  mode: Mode;
  difficulty: Difficulty;
  /** Schwierigkeit des Partners (nur 4 Spieler); Standard = wie die Gegner. */
  partnerDifficulty?: Difficulty;
  seed?: number;
  /** Alle Plätze von der KI spielen lassen (Simulation). */
  allBots?: boolean;
  /** Online: Namen pro Platz. */
  names?: string[];
  /** Online: welche Plätze von Menschen gespielt werden (Rest: KI). */
  humans?: boolean[];
  /** Aussehen der Charaktere pro Platz. */
  avatars?: (AvatarConfig | undefined)[];
  /** Schwierigkeit pro Platz, überschreibt difficulty (Simulation). */
  seatDifficulties?: Difficulty[];
  targetScore?: number;
}

const NAMES_4 = ['Du', 'Lena', 'Max', 'Jonas'];
const NAMES_2 = ['Du', 'Lena'];
const LOG_LIMIT = 60;

export function newGame(opts: NewGameOptions): GameState {
  const n = opts.mode;
  const names = opts.names ?? (n === 4 ? NAMES_4 : NAMES_2);
  const players: Player[] = names.map((name, i) => {
    const isPartner = n === 4 && i === 2;
    return {
      name,
      team: i % 2,
      hand: [],
      isHuman: opts.humans ? opts.humans[i] : i === 0 && !opts.allBots,
      avatar: opts.avatars?.[i],
      difficulty: opts.seatDifficulties?.[i] ?? (isPartner ? opts.partnerDifficulty ?? opts.difficulty : opts.difficulty),
    };
  });
  const teams: TeamState[] = [0, 1].map(() => ({ melds: [], redThrees: [], score: 0 }));
  const state: GameState = {
    mode: n,
    players,
    teams,
    stock: [],
    discard: [],
    pileFrozen: false,
    current: 0,
    // Geber ist der Spieler rechts vom Menschen, damit der Mensch in Runde 1 beginnt.
    dealer: n - 1,
    phase: 'draw',
    round: 0,
    turnStartTeamMelded: false,
    turnStartAnyoneMelded: false,
    rng: opts.seed ?? Math.floor(Math.random() * 2 ** 31),
    lastRound: null,
    history: [],
    winner: null,
    events: [],
    log: [],
    targetScore: opts.targetScore ?? 5000,
  };
  return startRound(state, true);
}

function clone(s: GameState): GameState {
  return structuredClone(s);
}

function log(s: GameState, msg: string) {
  s.log.push(msg);
  if (s.log.length > LOG_LIMIT) s.log.splice(0, s.log.length - LOG_LIMIT);
}

function startRound(prev: GameState, first = false): GameState {
  const s = clone(prev);
  const n = s.players.length;
  s.round += 1;
  if (!first) s.dealer = (s.dealer + 1) % n;
  s.current = (s.dealer + 1) % n;
  for (const t of s.teams) {
    t.melds = [];
    t.redThrees = [];
  }
  for (const p of s.players) p.hand = [];
  s.events = [];
  s.lastRound = null;

  const [deck, rng] = shuffle(createDeck(), s.rng);
  s.rng = rng;
  s.stock = deck;
  const size = handSize(s.mode);
  for (let k = 0; k < size; k++) {
    for (let i = 0; i < n; i++) s.players[(s.current + i) % n].hand.push(s.stock.pop()!);
  }
  log(s, `Runde ${s.round} beginnt. ${s.players[s.current].name} ${s.players[s.current].name === 'Du' ? 'beginnst' : 'beginnt'}.`);

  // Rote Dreien werden sofort ausgelegt und ersetzt.
  for (let i = 0; i < n; i++) {
    const pi = (s.current + i) % n;
    const p = s.players[pi];
    let red = p.hand.filter(isRedThree);
    while (red.length > 0) {
      p.hand = p.hand.filter((c) => !isRedThree(c));
      teamOf(s, pi).redThrees.push(...red);
      log(s, `${p.name} legt ${red.length === 1 ? 'eine rote 3' : `${red.length} rote Dreien`} aus.`);
      const replacements = red.map(() => s.stock.pop()!).filter(Boolean);
      p.hand.push(...replacements);
      red = replacements.filter(isRedThree);
    }
  }

  // Startkarte: Wildcard oder rote 3 frieren den Stapel ein, dann wird weiter aufgedeckt.
  s.discard = [];
  s.pileFrozen = false;
  for (;;) {
    const c = s.stock.pop()!;
    s.discard.push(c);
    if (isWild(c) || isRedThree(c)) {
      s.pileFrozen = true;
      continue;
    }
    break;
  }
  beginTurn(s);
  return s;
}

function beginTurn(s: GameState) {
  s.phase = 'draw';
  s.turnStartTeamMelded = hasMelded(teamOf(s, s.current));
  s.turnStartAnyoneMelded = s.teams.some(hasMelded);
}

function canGoOut(s: GameState, melds: Meld[]): boolean {
  return canastaCount(melds) >= requiredCanastas(s.mode);
}

function goOutError(s: GameState): string {
  return s.mode === 4 ? 'Zum Ausmachen braucht ihr mindestens einen Canasta.' : 'Zum Ausmachen brauchst du mindestens einen Canasta.';
}

/** Zieht eine Karte vom Stock; rote Dreien werden ausgelegt und ersetzt. Gibt null zurück, wenn der Stock leer ist. */
function drawOne(s: GameState, pi: number): Card | null {
  const p = s.players[pi];
  for (;;) {
    const c = s.stock.pop();
    if (!c) return null;
    if (isRedThree(c)) {
      teamOf(s, pi).redThrees.push(c);
      log(s, `${p.name} zieht eine rote 3 und legt sie aus.`);
      continue;
    }
    p.hand.push(c);
    return c;
  }
}

export function currentMinimum(s: GameState, pi: number): number {
  return initialMeldMinimum(teamOf(s, pi).score);
}

export function applyAction(state: GameState, action: Action): Result {
  if (action.type === 'nextRound') {
    if (state.phase !== 'roundOver') return { ok: false, error: 'Die Runde läuft noch.' };
    return { ok: true, state: startRound(state) };
  }
  if (state.phase === 'roundOver' || state.phase === 'gameOver') return { ok: false, error: 'Die Runde ist vorbei.' };

  const s = clone(state);
  const pi = s.current;
  const player = s.players[pi];
  const team = teamOf(s, pi);

  switch (action.type) {
    case 'drawStock': {
      if (s.phase !== 'draw') return { ok: false, error: 'Du hast schon gezogen.' };
      if (!drawOne(s, pi)) {
        log(s, 'Der Stock ist aufgebraucht.');
        return { ok: true, state: endRound(s, null) };
      }
      log(s, `${player.name} ${player.name === 'Du' ? 'ziehst' : 'zieht'} eine Karte.`);
      s.phase = 'play';
      return { ok: true, state: s };
    }

    case 'takePile': {
      if (s.phase !== 'draw') return { ok: false, error: 'Du hast schon gezogen.' };
      const top = topDiscard(s);
      if (!top) return { ok: false, error: 'Der Ablagestapel ist leer.' };
      if (isWild(top)) return { ok: false, error: 'Eine Wildcard oben blockiert den Stapel.' };
      if (isBlackThree(top)) return { ok: false, error: 'Eine schwarze 3 blockiert den Stapel.' };

      const frozen = isPileFrozenFor(s, pi);
      const teamMelded = hasMelded(team);
      const withCards = action.withCards
        .map((id) => player.hand.find((c) => c.id === id))
        .filter((c): c is Card => !!c);
      if (withCards.length !== action.withCards.length) return { ok: false, error: 'Diese Karte ist nicht auf deiner Hand.' };

      let firstGroup: MeldGroup;
      if (withCards.length === 0) {
        if (frozen) return { ok: false, error: 'Der Stapel ist eingefroren – du brauchst zwei passende natürliche Karten.' };
        if (!team.melds.some((m) => m.rank === top.rank))
          return { ok: false, error: `Wähle Karten aus, die zur ${cardLabel(top)} passen.` };
        firstGroup = { cardIds: [], target: top.rank };
      } else {
        if (frozen) {
          const pair = withCards.filter((c) => isNatural(c) && c.rank === top.rank).length;
          if (pair < 2)
            return {
              ok: false,
              error: teamMelded
                ? 'Der Stapel ist eingefroren – du brauchst zwei passende natürliche Karten.'
                : 'Vor eurer Erstmeldung brauchst du zwei passende natürliche Karten.',
            };
        }
        firstGroup = { cardIds: action.withCards };
      }

      const groups = [firstGroup, ...(action.extraMelds ?? [])];
      const res = resolveGroups(team.melds, player.hand, groups, top);
      if (typeof res === 'string') return { ok: false, error: res };
      if (!teamMelded) {
        const min = initialMeldMinimum(team.score);
        const val = sumValues(res.placed);
        if (val < min) return { ok: false, error: `Die Erstmeldung braucht ${min} Punkte (du hast ${val}).` };
      }

      const rest = s.discard.slice(0, -1);
      const redThrees = rest.filter(isRedThree);
      const restCards = rest.filter((c) => !isRedThree(c));
      const newHand = [...res.hand, ...restCards];
      const goingOut = newHand.length <= 1;
      if (goingOut && !canGoOut(s, res.melds)) return { ok: false, error: goOutError(s) };
      if (res.usedBlackThrees && !goingOut) return { ok: false, error: 'Schwarze Dreien darfst du nur beim Ausmachen melden.' };

      team.melds = res.melds;
      team.redThrees.push(...redThrees);
      player.hand = newHand;
      s.discard = [];
      s.pileFrozen = false;
      s.events.push({ kind: 'takePile', player: pi, cards: restCards });
      s.events.push({ kind: 'meld', player: pi, cards: res.placed });
      log(s, `${player.name} ${player.name === 'Du' ? 'nimmst' : 'nimmt'} den Stapel (${rest.length + 1} Karten).`);
      s.phase = 'play';
      if (newHand.length === 0) return { ok: true, state: endRound(s, pi) };
      return { ok: true, state: s };
    }

    case 'meld': {
      if (s.phase !== 'play') return { ok: false, error: 'Zieh zuerst eine Karte.' };
      if (action.groups.length === 0) return { ok: false, error: 'Keine Karten ausgewählt.' };
      const res = resolveGroups(team.melds, player.hand, action.groups);
      if (typeof res === 'string') return { ok: false, error: res };
      if (res.placed.length === 0) return { ok: false, error: 'Keine Karten ausgewählt.' };
      const goingOut = res.hand.length <= 1;
      if (goingOut && !canGoOut(s, res.melds)) {
        return {
          ok: false,
          error: res.hand.length === 0 ? goOutError(s) : `Du musst eine Karte zum Abwerfen behalten. ${goOutError(s)}`,
        };
      }
      if (res.usedBlackThrees && !goingOut) return { ok: false, error: 'Schwarze Dreien darfst du nur beim Ausmachen melden.' };
      if (!hasMelded(team)) {
        // Wer verdeckt in einem Zug ausmacht, muss den Mindestwert nicht erreichen.
        const concealedOut = goingOut && !s.turnStartTeamMelded;
        const min = initialMeldMinimum(team.score);
        const val = sumValues(res.placed);
        if (!concealedOut && val < min) return { ok: false, error: `Die Erstmeldung braucht ${min} Punkte (du hast ${val}).` };
      }
      team.melds = res.melds;
      player.hand = res.hand;
      s.events.push({ kind: 'meld', player: pi, cards: res.placed });
      log(s, `${player.name} ${player.name === 'Du' ? 'legst' : 'legt'} ${res.placed.length} Karten aus.`);
      if (player.hand.length === 0) return { ok: true, state: endRound(s, pi) };
      return { ok: true, state: s };
    }

    case 'discard': {
      if (s.phase !== 'play') return { ok: false, error: 'Zieh zuerst eine Karte.' };
      const card = player.hand.find((c) => c.id === action.cardId);
      if (!card) return { ok: false, error: 'Diese Karte ist nicht auf deiner Hand.' };
      if (player.hand.length === 1 && !canGoOut(s, team.melds)) return { ok: false, error: goOutError(s) };
      player.hand = player.hand.filter((c) => c.id !== card.id);
      s.discard.push(card);
      if (isWild(card)) s.pileFrozen = true;
      s.events.push({ kind: 'discard', player: pi, card });
      log(s, `${player.name} ${player.name === 'Du' ? 'wirfst' : 'wirft'} ${cardLabel(card)} ab.${isWild(card) ? ' Der Stapel ist eingefroren.' : ''}`);
      if (player.hand.length === 0) return { ok: true, state: endRound(s, pi) };
      s.current = (pi + 1) % s.players.length;
      beginTurn(s);
      return { ok: true, state: s };
    }
  }
}

/** Wertung einer Runde für ein Team. */
export function scoreTeam(
  s: GameState,
  teamIndex: number,
  wentOut: number | null,
  goOutKind: RoundResult['goOutKind'],
): TeamRoundScore {
  const team = s.teams[teamIndex];
  const meldPoints = team.melds.reduce((sum, m) => sum + sumValues(m.cards), 0);
  const naturalCanastas = team.melds.filter(isNaturalCanasta).length;
  const mixedCanastas = team.melds.filter((m) => isCanasta(m) && !isNaturalCanasta(m)).length;
  const canastaBonus = naturalCanastas * 500 + mixedCanastas * 300;
  const reds = team.redThrees.length;
  let redThreeBonus = reds === 4 ? 800 : reds * 100;
  // Hausregel: Ohne Canasta zählen rote Dreien minus.
  if (naturalCanastas + mixedCanastas === 0) redThreeBonus = -redThreeBonus;
  const handPenalty = teamMembers(s, teamIndex).reduce((sum, pi) => sum + sumValues(s.players[pi].hand), 0);
  let goOutBonus = 0;
  if (wentOut !== null && s.players[wentOut].team === teamIndex) {
    goOutBonus = goOutKind === 'handcanasta' ? 1000 : goOutKind === 'concealed' ? 200 : 100;
  }
  return {
    meldPoints,
    handPenalty,
    canastaBonus,
    redThreeBonus,
    goOutBonus,
    naturalCanastas,
    mixedCanastas,
    total: meldPoints - handPenalty + canastaBonus + redThreeBonus + goOutBonus,
  };
}

function endRound(s: GameState, wentOut: number | null): GameState {
  let goOutKind: RoundResult['goOutKind'] = null;
  if (wentOut !== null) {
    goOutKind = !s.turnStartAnyoneMelded ? 'handcanasta' : !s.turnStartTeamMelded ? 'concealed' : 'normal';
    const name = s.players[wentOut].name;
    const msg =
      goOutKind === 'handcanasta' ? 'Handcanasta!' : goOutKind === 'concealed' ? 'verdeckt ausgemacht!' : 'ausgemacht.';
    log(s, `${name}: ${msg}`);
  }
  const teams = s.teams.map((_, ti) => scoreTeam(s, ti, wentOut, goOutKind));
  teams.forEach((t, ti) => (s.teams[ti].score += t.total));
  const result: RoundResult = { wentOut, goOutKind, teams };
  s.lastRound = result;
  s.history.push(result);

  const scores = s.teams.map((t) => t.score);
  const best = Math.max(...scores);
  if (best >= s.targetScore && scores.filter((x) => x === best).length === 1) {
    s.phase = 'gameOver';
    s.winner = scores.indexOf(best);
  } else {
    s.phase = 'roundOver';
  }
  return s;
}

// Hilfen für UI und KI

export function canTakePileAtAll(s: GameState): boolean {
  const top = topDiscard(s);
  return !!top && !isWild(top) && !isBlackThree(top);
}

export function describeMeld(m: Meld): string {
  return `${rankPlural(m.rank)} (${m.cards.length})`;
}

export function handValue(cards: Card[]): number {
  return cards.reduce((s, c) => s + cardValue(c), 0);
}
