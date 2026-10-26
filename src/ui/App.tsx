import { useState } from 'react';
import { DIFFICULTY_LABEL } from '../ai/difficulty';
import { newGame } from '../engine/game';
import type { Difficulty, GameState, Mode } from '../engine/types';
import { loadGame, loadSettings, loadStats, recordResult, saveGame, saveSettings, type Settings } from '../storage';
import { Game } from './Game';
import { Online } from './Online';
import { useEngine } from './useEngine';
import { Rules } from './Rules';

type Screen = 'menu' | 'game' | 'rules' | 'online';

const initialJoin = new URLSearchParams(location.search).get('join');

export function App() {
  const [screen, setScreen] = useState<Screen>(initialJoin ? 'online' : 'menu');
  const [joinCode, setJoinCode] = useState(initialJoin);

  const leaveOnline = () => {
    setJoinCode(null);
    history.replaceState(null, '', location.pathname);
    setScreen('menu');
  };
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [game, setGame] = useState<GameState | null>(loadGame);
  const [gameKey, setGameKey] = useState(0);

  const update = (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveSettings(next);
  };

  const start = () => {
    const g = newGame({ mode: settings.mode, difficulty: settings.difficulty, targetScore: settings.targetScore });
    saveGame(g);
    setGame(g);
    setGameKey((k) => k + 1);
    setScreen('game');
  };

  if (screen === 'game' && game) {
    return (
      <LocalGame
        key={gameKey}
        initial={game}
        fast={settings.fast}
        onExit={() => {
          setGame(loadGame());
          setScreen('menu');
        }}
        onNewGame={start}
      />
    );
  }
  if (screen === 'online') return <Online settings={settings} joinCode={joinCode} onExit={leaveOnline} />;
  if (screen === 'rules') return <Rules onBack={() => setScreen('menu')} />;

  const stats = loadStats();
  return (
    <div className="menu">
      <h1>
        <span className="suit red">♥</span> Canasta <span className="suit">♠</span>
      </h1>
      <p className="tagline">Klassisches Canasta – offline gegen den Computer</p>

      {game && (
        <button className="big" onClick={() => setScreen('game')}>
          Weiterspielen
          <small>
            {game.mode} Spieler · {DIFFICULTY_LABEL[game.players[1].difficulty]} · Runde {game.round} · {game.teams[0].score} : {game.teams[1].score}
          </small>
        </button>
      )}

      <div className="menu-card">
        <label>Spieler</label>
        <div className="segmented">
          {([4, 2] as Mode[]).map((m) => (
            <button key={m} className={settings.mode === m ? 'on' : ''} onClick={() => update({ mode: m })}>
              {m === 4 ? '4 Spieler (Teams)' : '2 Spieler'}
            </button>
          ))}
        </div>

        <label>Schwierigkeit</label>
        <div className="segmented">
          {(['easy', 'medium', 'hard'] as Difficulty[]).map((d) => (
            <button key={d} className={settings.difficulty === d ? 'on' : ''} onClick={() => update({ difficulty: d })}>
              {DIFFICULTY_LABEL[d]}
            </button>
          ))}
        </div>

        <label>Spielziel</label>
        <div className="segmented">
          {[1500, 3000, 5000].map((t) => (
            <button key={t} className={settings.targetScore === t ? 'on' : ''} onClick={() => update({ targetScore: t })}>
              {t} Punkte
            </button>
          ))}
        </div>

        <label>Tempo der Gegner</label>
        <div className="segmented">
          <button className={!settings.fast ? 'on' : ''} onClick={() => update({ fast: false })}>
            Normal
          </button>
          <button className={settings.fast ? 'on' : ''} onClick={() => update({ fast: true })}>
            Schnell
          </button>
        </div>

        <button className="big primary" onClick={start}>
          {game ? 'Neues Spiel starten' : 'Spiel starten'}
        </button>
      </div>

      <button className="big online" onClick={() => setScreen('online')}>
        🌐 Online mit Freunden
        <small>Spiel per Code teilen oder beitreten</small>
      </button>

      <button className="ghost" onClick={() => setScreen('rules')}>
        Spielregeln
      </button>

      {Object.keys(stats).length > 0 && (
        <div className="stats">
          {Object.entries(stats).map(([k, v]) => {
            const [mode, diff] = k.split('-');
            return (
              <span key={k}>
                {mode} Spieler {DIFFICULTY_LABEL[diff as Difficulty]}: {v.won} gewonnen / {v.lost} verloren
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LocalGame({
  initial,
  fast,
  onExit,
  onNewGame,
}: {
  initial: GameState;
  fast: boolean;
  onExit: () => void;
  onNewGame: () => void;
}) {
  const { game, act } = useEngine(initial, fast, (next, prev) => {
    if (next.phase === 'gameOver' && prev.phase !== 'gameOver') {
      recordResult(next.mode, next.players[1].difficulty, next.winner === next.players[0].team);
    }
    saveGame(next.phase === 'gameOver' ? null : next);
  });
  return <Game game={game} act={act} onExit={onExit} onNewGame={onNewGame} />;
}
