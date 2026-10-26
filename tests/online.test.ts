import { describe, expect, it } from 'vitest';
import { applyAction, newGame } from '../src/engine/game';
import { makeView } from '../src/online/protocol';

describe('Online-Ansicht', () => {
  const s = newGame({ mode: 4, difficulty: 'easy', seed: 3, names: ['Felix', 'Anna', 'Ben', 'Lena 🤖'], humans: [true, true, true, false] });

  it('setzt den Spieler auf Platz 0, nennt ihn „Du“ und dreht Indizes mit', () => {
    const v = makeView(s, 1);
    expect(v.players[0].name).toBe('Du');
    expect(v.players[0].hand).toEqual(s.players[1].hand);
    expect(v.players[1].name).toBe('Ben');
    expect(v.players[3].name).toBe('Felix');
    expect(v.current).toBe((s.current - 1 + 4) % 4);
    expect(v.players[0].team).toBe(1);
  });

  it('versteckt fremde Hände und den Stock, behält aber die Anzahl', () => {
    const v = makeView(s, 2);
    for (let i = 1; i < 4; i++) {
      expect(v.players[i].hand.length).toBe(s.players[(i + 2) % 4].hand.length);
      expect(v.players[i].hand.every((c) => c.id < 0)).toBe(true);
    }
    expect(v.stock.length).toBe(s.stock.length);
    expect(v.stock.every((c) => c.id < 0)).toBe(true);
    expect(v.rng).toBe(0);
  });

  it('Logs sprechen online niemanden mit „Du“ an', () => {
    const r = applyAction(s, { type: 'drawStock' });
    expect(r.ok && r.state.log[r.state.log.length - 1]).toMatch(/zieht eine Karte/);
  });
});
