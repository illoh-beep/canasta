import type { Difficulty, Mode } from '../engine/types';

export interface Profile {
  /** Wahrscheinlichkeit, beim Abwerfen eine zufällige statt der besten Karte zu wählen. */
  discardMistake: number;
  /** Wie viele der letzten öffentlichen Ereignisse sich der Bot merkt. */
  memory: number;
  /** Mindestgröße des Stapels, damit der Bot ihn aufnimmt (je Spielerzahl). */
  minPile: Record<Mode, number>;
  /** Mindestgröße des Stapels, für die der Bot eine Wildcard opfert (je Spielerzahl). */
  minPileForWild: Record<Mode, number>;
  /** Chance, eine Gelegenheit zum Stapelnehmen zu übersehen. */
  missPile: number;
  /** Chance, das Anlegen an eigene Meldungen zu vergessen. */
  missLayoff: number;
  /** Legt Paare mit Wildcards aus statt sie für den Stapel zu behalten. */
  dumpsPairs: boolean;
  /** Verteilt Wildcards wahllos statt gezielt Canastas zu schließen. */
  wastesWilds: boolean;
  /** Achtet darauf, dem nächsten Gegner keine brauchbaren Karten zu geben. */
  safeDiscards: boolean;
  /** Friert einen großen Stapel gezielt mit einer Wildcard ein. */
  freezes: boolean;
  /** Zählt Karten und schätzt per Wahrscheinlichkeit, ob der Gegner einen Abwurf verwenden kann. */
  countsCards: boolean;
}

export const PROFILES: Record<Difficulty, Profile> = {
  easy: {
    discardMistake: 0.35,
    memory: 0,
    minPile: { 2: 4, 4: 4 },
    minPileForWild: { 2: 99, 4: 99 },
    missPile: 0.5,
    missLayoff: 0.3,
    dumpsPairs: true,
    wastesWilds: true,
    safeDiscards: false,
    freezes: false,
    countsCards: false,
  },
  medium: {
    discardMistake: 0.12,
    memory: 10,
    minPile: { 2: 3, 4: 3 },
    minPileForWild: { 2: 7, 4: 7 },
    missPile: 0.15,
    missLayoff: 0.05,
    dumpsPairs: false,
    wastesWilds: false,
    safeDiscards: true,
    freezes: false,
    countsCards: false,
  },
  hard: {
    discardMistake: 0,
    memory: Infinity,
    // Per Bot-Simulation abgestimmt: im Zweierspiel lohnen erst größere Stapel.
    minPile: { 2: 6, 4: 3 },
    minPileForWild: { 2: 7, 4: 4 },
    missPile: 0,
    missLayoff: 0,
    dumpsPairs: false,
    wastesWilds: false,
    safeDiscards: true,
    freezes: true,
    countsCards: true,
  },
};

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: 'Leicht',
  medium: 'Mittel',
  hard: 'Schwer',
};
