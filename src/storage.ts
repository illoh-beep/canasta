import type { Difficulty, GameState, Mode } from './engine/types';

export interface Settings {
  mode: Mode;
  difficulty: Difficulty;
  targetScore: number;
  fast: boolean;
}

export interface Stats {
  [key: string]: { won: number; lost: number };
}

const GAME_KEY = 'canasta.game.v1';
const SETTINGS_KEY = 'canasta.settings.v1';
const STATS_KEY = 'canasta.stats.v1';

export const DEFAULT_SETTINGS: Settings = { mode: 4, difficulty: 'medium', targetScore: 5000, fast: false };

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Speicher voll oder gesperrt – das Spiel läuft trotzdem weiter.
  }
}

export const loadGame = () => read<GameState>(GAME_KEY);
export const saveGame = (g: GameState | null) => write(GAME_KEY, g);
export const loadSettings = (): Settings => ({ ...DEFAULT_SETTINGS, ...read<Settings>(SETTINGS_KEY) });
export const saveSettings = (s: Settings) => write(SETTINGS_KEY, s);
export const loadStats = (): Stats => read<Stats>(STATS_KEY) ?? {};

export function recordResult(mode: Mode, difficulty: Difficulty, won: boolean) {
  const stats = loadStats();
  const key = `${mode}-${difficulty}`;
  const entry = stats[key] ?? { won: 0, lost: 0 };
  if (won) entry.won++;
  else entry.lost++;
  stats[key] = entry;
  write(STATS_KEY, stats);
}
