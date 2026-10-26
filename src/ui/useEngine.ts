import { useCallback, useEffect, useRef, useState } from 'react';
import { chooseAction } from '../ai/bot';
import { applyAction } from '../engine/game';
import type { Action, GameState } from '../engine/types';

/**
 * Hält den echten Spielstand (lokal oder beim Online-Gastgeber), lässt die Bots ziehen
 * und meldet jeden neuen Stand an onCommit.
 */
export function useEngine(initial: GameState, fast: boolean, onCommit: (next: GameState, prev: GameState) => void) {
  const [game, setGame] = useState(initial);
  const ref = useRef(initial);
  const commitRef = useRef(onCommit);
  commitRef.current = onCommit;

  const act = useCallback((a: Action): string | null => {
    const prev = ref.current;
    const r = applyAction(prev, a);
    if (!r.ok) return r.error;
    ref.current = r.state;
    setGame(r.state);
    commitRef.current(r.state, prev);
    return null;
  }, []);

  // Bots spielen mit kurzer Pause, damit man ihre Züge verfolgen kann.
  useEffect(() => {
    if (game.phase !== 'draw' && game.phase !== 'play') return;
    if (game.players[game.current].isHuman) return;
    const delay = (fast ? 0.35 : 1) * (game.phase === 'draw' ? 700 : 850);
    const t = window.setTimeout(() => act(chooseAction(ref.current)), delay);
    return () => window.clearTimeout(t);
  }, [game, fast, act]);

  return { game, act, ref };
}
