import { useEffect, useMemo, useRef, useState } from 'react';
import { chooseAction } from '../ai/bot';
import { DIFFICULTY_LABEL } from '../ai/difficulty';
import { isWild, rankPlural, sortHand, sumValues } from '../engine/cards';
import { applyAction, canTakePileAtAll, currentMinimum } from '../engine/game';
import { hasMelded, isCanasta, isNaturalCanasta, isPileFrozenFor, requiredCanastas, topDiscard } from '../engine/rules';
import type { Action, GameState, Meld, MeldGroup, TeamRoundScore } from '../engine/types';
import { recordResult, saveGame } from '../storage';
import { CardView } from './CardView';

interface Props {
  initial: GameState;
  fast: boolean;
  onExit: () => void;
  onNewGame: () => void;
}

const HUMAN = 0;

export function teamName(s: GameState, team: number): string {
  if (s.mode === 2) return s.players[team].name;
  return team === 0 ? 'Ihr' : 'Gegner';
}

export function Game({ initial, fast, onExit, onNewGame }: Props) {
  const [game, setGame] = useState(initial);
  const [selected, setSelected] = useState<number[]>([]);
  const [staged, setStaged] = useState<MeldGroup[]>([]);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [fresh, setFresh] = useState<Set<number>>(new Set());
  const msgTimer = useRef<number>();

  const me = game.players[HUMAN];
  const myTurn = game.current === HUMAN && (game.phase === 'draw' || game.phase === 'play');
  const stagedIds = useMemo(() => new Set(staged.flatMap((g) => g.cardIds)), [staged]);
  const hand = useMemo(() => sortHand(me.hand.filter((c) => !stagedIds.has(c.id))), [me.hand, stagedIds]);
  const myTeam = game.teams[me.team];

  function flash(text: string, error = false) {
    setMessage({ text, error });
    window.clearTimeout(msgTimer.current);
    msgTimer.current = window.setTimeout(() => setMessage(null), error ? 3500 : 2500);
  }

  function commit(next: GameState) {
    const before = new Set(game.players[HUMAN].hand.map((c) => c.id));
    const added = next.players[HUMAN].hand.filter((c) => !before.has(c.id)).map((c) => c.id);
    if (added.length > 0 && next.round === game.round) {
      setFresh(new Set(added));
      window.setTimeout(() => setFresh(new Set()), 2500);
    }
    if (next.phase === 'gameOver' && game.phase !== 'gameOver') {
      recordResult(next.mode, next.players[1].difficulty, next.winner === me.team);
    }
    setGame(next);
    saveGame(next.phase === 'gameOver' ? null : next);
  }

  function act(a: Action): boolean {
    const r = applyAction(game, a);
    if (!r.ok) {
      flash(r.error, true);
      return false;
    }
    commit(r.state);
    return true;
  }

  // Bots spielen mit kurzer Pause, damit man ihre Züge verfolgen kann.
  useEffect(() => {
    if (game.phase !== 'draw' && game.phase !== 'play') return;
    if (game.players[game.current].isHuman) return;
    const delay = (fast ? 0.35 : 1) * (game.phase === 'draw' ? 700 : 850);
    const t = window.setTimeout(() => {
      const r = applyAction(game, chooseAction(game));
      if (r.ok) commit(r.state);
    }, delay);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, fast]);

  useEffect(() => {
    if (game.phase === 'roundOver' || game.phase === 'gameOver' || game.current !== HUMAN) {
      setSelected([]);
      setStaged([]);
    }
  }, [game.phase, game.current, game.round]);

  const toggle = (id: number) => {
    if (!myTurn) return;
    setSelected((sel) => (sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]));
  };

  const onStock = () => {
    if (!myTurn) return;
    if (game.phase !== 'draw') return flash('Du hast schon gezogen.', true);
    act({ type: 'drawStock' });
  };

  const onPile = () => {
    if (!myTurn) return;
    if (game.phase !== 'draw') return flash('Du hast schon gezogen.', true);
    if (act({ type: 'takePile', withCards: selected, extraMelds: staged })) {
      setSelected([]);
      setStaged([]);
    }
  };

  const onMeld = () => {
    const groups = [...staged, ...(selected.length > 0 ? [{ cardIds: selected }] : [])];
    if (groups.length === 0) return flash('Wähle zuerst Karten aus.', true);
    if (act({ type: 'meld', groups })) {
      setSelected([]);
      setStaged([]);
    }
  };

  const onStage = () => {
    if (selected.length === 0) return flash('Wähle zuerst Karten aus.', true);
    setStaged((s) => [...s, { cardIds: selected }]);
    setSelected([]);
  };

  const onMeldClick = (m: Meld) => {
    if (!myTurn || game.phase !== 'play' || selected.length === 0) return;
    if (act({ type: 'meld', groups: [{ cardIds: selected, target: m.rank }] })) setSelected([]);
  };

  const onDiscard = () => {
    if (selected.length !== 1) return flash('Wähle genau eine Karte zum Abwerfen.', true);
    if (staged.length > 0) return flash('Lege die vorgemerkten Karten zuerst aus oder nimm sie zurück.', true);
    if (act({ type: 'discard', cardId: selected[0] })) setSelected([]);
  };

  const selCards = me.hand.filter((c) => selected.includes(c.id));
  const stagedCards = me.hand.filter((c) => stagedIds.has(c.id));
  const minimum = currentMinimum(game, HUMAN);
  const needsInitial = !hasMelded(myTeam);
  const top = topDiscard(game);
  const frozenForMe = isPileFrozenFor(game, HUMAN);

  let hint = '';
  if (game.phase === 'draw' || game.phase === 'play') {
    if (!myTurn) hint = `${game.players[game.current].name} ist am Zug …`;
    else if (game.phase === 'draw') hint = 'Ziehe vom Stock – oder wähle passende Karten und tippe auf den Ablagestapel.';
    else hint = 'Lege aus (Karten wählen → Auslegen oder auf eine eigene Meldung tippen) und wirf dann eine Karte ab.';
  }

  const opponents = game.mode === 4 ? [1, 2, 3] : [1];

  return (
    <div className={`game mode-${game.mode}`}>
      <header className="topbar">
        <button className="ghost" onClick={onExit}>
          ☰ Menü
        </button>
        <div className="scores">
          {game.teams.map((t, i) => (
            <span key={i} className={i === me.team ? 'mine' : ''}>
              {teamName(game, i)}: <b>{t.score}</b>
            </span>
          ))}
        </div>
        <span className="meta">
          Runde {game.round} · {DIFFICULTY_LABEL[game.players[1].difficulty]}
        </span>
      </header>

      <section className="seats">
        {opponents.map((pi) => {
          const p = game.players[pi];
          const pos = game.mode === 2 ? 'top' : pi === 1 ? 'left' : pi === 2 ? 'top' : 'right';
          return (
            <div key={pi} className={`seat ${pos} ${game.current === pi ? 'active' : ''}`}>
              <div className="seat-name">
                {p.name}
                {game.mode === 4 && pi === 2 ? ' (Partner)' : ''}
              </div>
              <div className="seat-cards">
                {p.hand.slice(0, 12).map((c) => (
                  <CardView key={c.id} faceDown small />
                ))}
              </div>
              <div className="seat-count">{p.hand.length} Karten</div>
            </div>
          );
        })}
      </section>

      <MeldRow game={game} team={1 - me.team} />

      <section className="center">
        <div className="pile-block">
          <div className="pile stock" onClick={onStock}>
            {game.stock.length > 0 ? <CardView faceDown className={myTurn && game.phase === 'draw' ? 'glow' : ''} /> : <div className="card empty" />}
            <span className="pile-label">Stock {game.stock.length}</span>
          </div>
          <div className="pile discard" onClick={onPile}>
            {top ? (
              <CardView
                card={top}
                className={myTurn && game.phase === 'draw' && canTakePileAtAll(game) ? 'glow-soft' : ''}
              />
            ) : (
              <div className="card empty" />
            )}
            {game.pileFrozen && <span className="frozen" title="Eingefroren">❄</span>}
            <span className="pile-label">Ablage {game.discard.length}</span>
          </div>
        </div>
        <div className="info">
          {game.log.slice(-3).map((line, i, arr) => (
            <div key={game.log.length - arr.length + i} className={i === arr.length - 1 ? 'lastlog' : 'oldlog'}>
              {line}
            </div>
          ))}
          {myTurn && game.phase === 'draw' && top && (
            <div className="sub">
              {!canTakePileAtAll(game)
                ? 'Stapel gesperrt.'
                : frozenForMe
                  ? `Stapel eingefroren: zwei natürliche ${rankPlural(top.rank)} nötig.`
                  : 'Stapel offen.'}
            </div>
          )}
        </div>
      </section>

      <MeldRow game={game} team={me.team} onMeldClick={onMeldClick} clickable={myTurn && game.phase === 'play' && selected.length > 0} />

      {staged.length > 0 && (
        <section className="staged">
          <span className="label">Vorgemerkt:</span>
          {staged.map((g, i) => (
            <div key={i} className="staged-group" onClick={() => setStaged((s) => s.filter((_, j) => j !== i))} title="Zurücknehmen">
              {stagedCards
                .filter((c) => g.cardIds.includes(c.id))
                .map((c) => (
                  <CardView key={c.id} card={c} small />
                ))}
              <span className="x">✕</span>
            </div>
          ))}
        </section>
      )}

      <section className={`hand ${myTurn ? 'my-turn' : ''}`}>
        {hand.map((c) => (
          <CardView
            key={c.id}
            card={c}
            selected={selected.includes(c.id)}
            className={fresh.has(c.id) ? 'fresh' : ''}
            onClick={() => toggle(c.id)}
          />
        ))}
      </section>

      <footer className="controls">
        <div className="status">
          {message ? <span className={message.error ? 'error' : 'ok'}>{message.text}</span> : <span>{hint}</span>}
          {myTurn && (selected.length > 0 || staged.length > 0) && (
            <span className="value">
              Auswahl: {sumValues([...selCards, ...stagedCards])} Punkte
              {needsInitial ? ` · Erstmeldung mind. ${minimum}` : ''}
            </span>
          )}
          {myTurn && needsInitial && selected.length === 0 && staged.length === 0 && (
            <span className="value">Erstmeldung mind. {minimum} Punkte</span>
          )}
        </div>
        <div className="buttons">
          <button disabled={!myTurn || game.phase !== 'play'} onClick={onMeld}>
            Auslegen
          </button>
          <button className="secondary" disabled={!myTurn || selected.length === 0} onClick={onStage} title="Mehrere Meldungen auf einmal auslegen (z. B. für die Erstmeldung)">
            Vormerken
          </button>
          <button disabled={!myTurn || game.phase !== 'play'} onClick={onDiscard}>
            Abwerfen
          </button>
          <button className="ghost narrow" disabled={selected.length === 0} onClick={() => setSelected([])} title="Auswahl aufheben">
            ✕
          </button>
        </div>
      </footer>

      {(game.phase === 'roundOver' || game.phase === 'gameOver') && game.lastRound && (
        <RoundSummary
          game={game}
          onNext={() => act({ type: 'nextRound' })}
          onNewGame={onNewGame}
          onExit={onExit}
        />
      )}
    </div>
  );
}

function MeldRow({
  game,
  team,
  onMeldClick,
  clickable,
}: {
  game: GameState;
  team: number;
  onMeldClick?: (m: Meld) => void;
  clickable?: boolean;
}) {
  const t = game.teams[team];
  const melds = [...t.melds].sort((a, b) => b.cards.length - a.cards.length || b.rank - a.rank);
  const canastas = t.melds.filter(isCanasta).length;
  return (
    <section className={`melds ${team === game.players[HUMAN].team ? 'own' : 'opp'}`}>
      <div className="melds-head">
        <span>{teamName(game, team)}</span>
        <span className="canasta-count">
          Canastas {canastas}/{requiredCanastas(game.mode)}
        </span>
        {t.redThrees.length > 0 && (
          <span className="reds">
            {t.redThrees.map((c) => (
              <CardView key={c.id} card={c} small />
            ))}
          </span>
        )}
      </div>
      <div className="melds-list">
        {melds.length === 0 && <span className="empty-note">noch nichts ausgelegt</span>}
        {melds.map((m) => (
          <MeldStack key={m.rank} meld={m} onClick={onMeldClick ? () => onMeldClick(m) : undefined} clickable={clickable} />
        ))}
      </div>
    </section>
  );
}

function MeldStack({ meld, onClick, clickable }: { meld: Meld; onClick?: () => void; clickable?: boolean }) {
  const canasta = isCanasta(meld);
  const natural = isNaturalCanasta(meld);
  const cards = [...meld.cards].sort((a, b) => Number(isWild(a)) - Number(isWild(b)));
  const shown = canasta ? cards.slice(0, 1) : cards;
  const wilds = meld.cards.filter(isWild).length;
  return (
    <div
      className={`meld ${canasta ? (natural ? 'canasta natural' : 'canasta mixed') : ''} ${clickable ? 'target' : ''}`}
      onClick={onClick}
      title={`${rankPlural(meld.rank)}: ${meld.cards.length} Karten, ${wilds} Wildcards`}
    >
      <div className="meld-cards">
        {shown.map((c) => (
          <CardView key={c.id} card={c} small />
        ))}
      </div>
      <span className="meld-badge">
        {canasta ? (natural ? 'rein' : 'gemischt') : ''} {meld.cards.length}
        {wilds > 0 && !canasta ? ` (${wilds}★)` : ''}
      </span>
    </div>
  );
}

function RoundSummary({
  game,
  onNext,
  onNewGame,
  onExit,
}: {
  game: GameState;
  onNext: () => void;
  onNewGame: () => void;
  onExit: () => void;
}) {
  const r = game.lastRound!;
  const over = game.phase === 'gameOver';
  const me = game.players[HUMAN];
  const rows: [string, (t: TeamRoundScore) => number][] = [
    ['Ausgelegte Karten', (t) => t.meldPoints],
    ['Canasta-Bonus', (t) => t.canastaBonus],
    ['Rote Dreien', (t) => t.redThreeBonus],
    ['Ausmachen', (t) => t.goOutBonus],
    ['Karten auf der Hand', (t) => -t.handPenalty],
  ];
  const outText =
    r.wentOut === null
      ? 'Der Stock ist aufgebraucht.'
      : `${game.players[r.wentOut].name} ${r.wentOut === HUMAN ? 'hast' : 'hat'} ${
          r.goOutKind === 'handcanasta' ? 'Handcanasta gemacht! 🎉' : r.goOutKind === 'concealed' ? 'verdeckt ausgemacht!' : 'ausgemacht.'
        }`;
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2>{over ? (game.winner === me.team ? 'Gewonnen! 🏆' : 'Verloren') : `Runde ${game.round} beendet`}</h2>
        <p>{outText}</p>
        <table className="score-table">
          <thead>
            <tr>
              <th />
              {game.teams.map((_, i) => (
                <th key={i}>{teamName(game, i)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, f]) => (
              <tr key={label}>
                <td>{label}</td>
                {r.teams.map((t, i) => (
                  <td key={i} className={f(t) < 0 ? 'neg' : ''}>
                    {f(t)}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="sum">
              <td>Runde</td>
              {r.teams.map((t, i) => (
                <td key={i}>{t.total}</td>
              ))}
            </tr>
            <tr className="total">
              <td>Gesamt</td>
              {game.teams.map((t, i) => (
                <td key={i}>{t.score}</td>
              ))}
            </tr>
          </tbody>
        </table>
        <p className="note">
          Canastas: {r.teams.map((t, i) => `${teamName(game, i)} ${t.naturalCanastas} rein / ${t.mixedCanastas} gemischt`).join(' · ')}
        </p>
        <div className="modal-buttons">
          {over ? (
            <>
              <button onClick={onNewGame}>Neues Spiel</button>
              <button className="ghost" onClick={onExit}>
                Menü
              </button>
            </>
          ) : (
            <button onClick={onNext}>Nächste Runde</button>
          )}
        </div>
      </div>
    </div>
  );
}
