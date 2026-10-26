import { describe, expect, it } from 'vitest';
import { chooseAction } from '../src/ai/bot';
import { nextRandom } from '../src/engine/cards';
import { applyAction, newGame } from '../src/engine/game';
import type { Difficulty, GameState, Mode } from '../src/engine/types';

function seeded(seed: number) {
  let s = seed;
  return () => {
    const [r, n] = nextRandom(s);
    s = n;
    return r;
  };
}

/** Spielt eine komplette Partie nur mit Bots und gibt das Siegerteam zurück. */
function playGame(mode: Mode, seats: Difficulty[], seed: number, target = 5000): { winner: number; rounds: number; state: GameState } {
  let s = newGame({ mode, difficulty: 'medium', seatDifficulties: seats, allBots: true, seed, targetScore: target });
  const rand = seeded(seed * 7 + 3);
  let steps = 0;
  while (s.phase !== 'gameOver') {
    if (++steps > 200000) throw new Error('Partie endet nicht');
    if (s.phase === 'roundOver') {
      s = (applyAction(s, { type: 'nextRound' }) as { state: GameState }).state;
      if (s.round > 200) throw new Error('Zu viele Runden');
      continue;
    }
    const a = chooseAction(s, rand);
    const r = applyAction(s, a);
    if (!r.ok) throw new Error(`Illegale Bot-Aktion: ${r.error} ${JSON.stringify(a)}`);
    s = r.state;
    // Kartenerhaltung: es gehen nie Karten verloren.
    const total =
      s.players.reduce((n, p) => n + p.hand.length, 0) +
      s.stock.length +
      s.discard.length +
      s.teams.reduce((n, t) => n + t.redThrees.length + t.melds.reduce((m, x) => m + x.cards.length, 0), 0);
    if (total !== 108) throw new Error(`Kartenzahl ${total}`);
  }
  return { winner: s.winner!, rounds: s.round, state: s };
}

describe('Bot-Simulation', () => {
  it('4 Spieler: Partien laufen fehlerfrei durch', () => {
    for (let seed = 1; seed <= 30; seed++) playGame(4, ['medium', 'hard', 'easy', 'medium'], seed);
  });

  it('2 Spieler: Partien laufen fehlerfrei durch', () => {
    for (let seed = 1; seed <= 30; seed++) playGame(2, ['hard', 'easy'], seed);
  });

  it('Schwer schlägt Leicht deutlich (4 Spieler)', () => {
    let hardWins = 0;
    const games = 60;
    for (let seed = 100; seed < 100 + games; seed++) {
      // Team 0 = schwer, Team 1 = leicht; Sitzplätze abwechselnd tauschen.
      const swap = seed % 2 === 0;
      const seats: Difficulty[] = swap ? ['easy', 'hard', 'easy', 'hard'] : ['hard', 'easy', 'hard', 'easy'];
      const { winner } = playGame(4, seats, seed, 3000);
      if (winner === (swap ? 1 : 0)) hardWins++;
    }
    console.log(`4 Spieler: Schwer gewinnt ${hardWins}/${games}`);
    expect(hardWins / games).toBeGreaterThan(0.65);
  });

  const duel = (mode: Mode, a: Difficulty, b: Difficulty, games: number) => {
    let aWins = 0;
    for (let seed = 500; seed < 500 + games; seed++) {
      const swap = seed % 2 === 0;
      const [x, y] = swap ? [b, a] : [a, b];
      const { winner } = playGame(mode, mode === 2 ? [x, y] : [x, y, x, y], seed, 3000);
      if (winner === (swap ? 1 : 0)) aWins++;
    }
    return aWins / games;
  };

  it('Stufen sind spürbar unterschiedlich stark (2 Spieler)', () => {
    const medVsEasy = duel(2, 'medium', 'easy', 120);
    const hardVsMed = duel(2, 'hard', 'medium', 120);
    console.log(`2 Spieler: Mittel vs Leicht ${medVsEasy}, Schwer vs Mittel ${hardVsMed}`);
    expect(medVsEasy).toBeGreaterThan(0.6);
    expect(hardVsMed).toBeGreaterThan(0.6);
  });

  it('Stufen sind spürbar unterschiedlich stark (4 Spieler)', () => {
    const medVsEasy = duel(4, 'medium', 'easy', 120);
    const hardVsMed = duel(4, 'hard', 'medium', 120);
    console.log(`4 Spieler: Mittel vs Leicht ${medVsEasy}, Schwer vs Mittel ${hardVsMed}`);
    expect(medVsEasy).toBeGreaterThan(0.6);
    expect(hardVsMed).toBeGreaterThan(0.55);
  });
});
