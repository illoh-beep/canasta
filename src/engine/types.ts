export type Suit = 'S' | 'H' | 'D' | 'C';

/** Rang 2–14 (11 = Bube, 12 = Dame, 13 = König, 14 = Ass), 0 = Joker. */
export type Rank = number;

export interface Card {
  id: number;
  rank: Rank;
  /** Joker haben keine Farbe. */
  suit: Suit | null;
}

export type Difficulty = 'easy' | 'medium' | 'hard';
export type Mode = 2 | 4;

export interface Meld {
  /** Natürlicher Rang der Meldung (3 nur für schwarze Dreien beim Ausmachen). */
  rank: Rank;
  cards: Card[];
}

export interface TeamState {
  melds: Meld[];
  redThrees: Card[];
  /** Gesamtpunktzahl über alle abgeschlossenen Runden. */
  score: number;
}

/** Aussehen des Spielercharakters (wird nur von der Oberfläche ausgewertet). */
export interface AvatarConfig {
  skin: number;
  eyes: string;
  mouth: string;
  hair: string;
  hairColor: number;
  beard: string;
  glasses: string;
  hat: string;
  extra: string;
  bg: number;
}

export interface Player {
  name: string;
  avatar?: AvatarConfig;
  team: number;
  hand: Card[];
  isHuman: boolean;
  difficulty: Difficulty;
}

export type Phase = 'draw' | 'play' | 'roundOver' | 'gameOver';

export interface TeamRoundScore {
  meldPoints: number;
  handPenalty: number;
  canastaBonus: number;
  redThreeBonus: number;
  goOutBonus: number;
  total: number;
  naturalCanastas: number;
  mixedCanastas: number;
}

export interface RoundResult {
  /** Spieler, der ausgemacht hat, oder null (Stock leer). */
  wentOut: number | null;
  goOutKind: 'normal' | 'concealed' | 'handcanasta' | null;
  teams: TeamRoundScore[];
}

/** Was ein Spieler über die Karten der anderen wissen kann (öffentliche Ereignisse). */
export type PublicEvent =
  | { kind: 'discard'; player: number; card: Card }
  | { kind: 'takePile'; player: number; cards: Card[] }
  | { kind: 'meld'; player: number; cards: Card[] };

export interface GameState {
  mode: Mode;
  players: Player[];
  teams: TeamState[];
  stock: Card[];
  discard: Card[];
  /** Stapel durch Wildcard (oder rote 3 als Startkarte) eingefroren. */
  pileFrozen: boolean;
  current: number;
  dealer: number;
  phase: Phase;
  round: number;
  /** Hatte das Team des aktuellen Spielers zu Zugbeginn schon ausgelegt? */
  turnStartTeamMelded: boolean;
  /** Hatte zu Zugbeginn irgendein Spieler am Tisch ausgelegt? */
  turnStartAnyoneMelded: boolean;
  rng: number;
  lastRound: RoundResult | null;
  history: RoundResult[];
  winner: number | null;
  events: PublicEvent[];
  log: string[];
  targetScore: number;
}

export interface MeldGroup {
  cardIds: number[];
  /** Rang einer bestehenden Teammeldung, an die angelegt wird; sonst neue Meldung. */
  target?: Rank;
}

export type Action =
  | { type: 'drawStock' }
  | {
      type: 'takePile';
      /** Handkarten, die mit der obersten Karte gemeldet werden (leer = an bestehende Meldung anlegen). */
      withCards: number[];
      /** Zusätzliche Meldungen aus der Hand (zählen für die Erstmeldung). */
      extraMelds?: MeldGroup[];
    }
  | { type: 'meld'; groups: MeldGroup[] }
  | { type: 'discard'; cardId: number }
  | { type: 'nextRound' };

export type Result = { ok: true; state: GameState } | { ok: false; error: string };
