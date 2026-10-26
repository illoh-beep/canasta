import { useEffect, useMemo, useRef, useState } from 'react';
import { DIFFICULTY_LABEL } from '../ai/difficulty';
import { isWild, rankPlural, sortHand, sumValues } from '../engine/cards';
import { autoGroup } from '../engine/autogroup';
import { canTakePileAtAll, currentMinimum } from '../engine/game';
import { hasMelded, initialMeldMinimum, isCanasta, isNaturalCanasta, isPileFrozenFor, topDiscard } from '../engine/rules';
import type { Action, Card, GameState, Meld, MeldGroup, TeamRoundScore, TeamState } from '../engine/types';
import { AvatarFace, BOT_AVATARS } from './avatar';
import { CardView } from './CardView';

interface Props {
  /** Spielstand aus Sicht des Spielers auf Platz 0. */
  game: GameState;
  /** Führt eine Aktion aus und liefert eine Fehlermeldung oder null. */
  act: (a: Action) => string | null | Promise<string | null>;
  onExit: () => void;
  onNewGame?: () => void;
  /** Kurzer Hinweis von außen (z. B. Verbindungsmeldungen im Online-Spiel). */
  notice?: { text: string } | null;
}

const HUMAN = 0;

export function teamName(s: GameState, team: number): string {
  if (s.mode === 2) return s.players.find((p) => p.team === team)!.name;
  return team === s.players[HUMAN].team ? 'Ihr' : 'Gegner';
}

export function Game({ game, act: perform, onExit, onNewGame, notice }: Props) {
  const [selected, setSelected] = useState<number[]>([]);
  const [staged, setStaged] = useState<MeldGroup[]>([]);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [fresh, setFresh] = useState<Set<number>>(new Set());
  const msgTimer = useRef<number>();
  const prevGame = useRef(game);

  const me = game.players[HUMAN];
  const myTurn = game.current === HUMAN && (game.phase === 'draw' || game.phase === 'play');
  const stagedIds = useMemo(() => new Set(staged.flatMap((g) => g.cardIds)), [staged]);
  const hand = useMemo(() => sortHand(me.hand.filter((c) => !stagedIds.has(c.id))), [me.hand, stagedIds]);
  // Gleicher Rang = ein Stapel (Joker und Zweien jeweils eigener Stapel).
  const stacks = useMemo(() => {
    const out: Card[][] = [];
    for (const c of hand) {
      const last = out[out.length - 1];
      if (last && last[0].rank === c.rank) last.push(c);
      else out.push([c]);
    }
    return out;
  }, [hand]);
  const myTeam = game.teams[me.team];

  function flash(text: string, error = false) {
    setMessage({ text, error });
    window.clearTimeout(msgTimer.current);
    msgTimer.current = window.setTimeout(() => setMessage(null), error ? 3500 : 2500);
  }

  useEffect(() => {
    if (notice) flash(notice.text);
  }, [notice]);

  // Neu aufgenommene Karten kurz hervorheben.
  useEffect(() => {
    const prev = prevGame.current;
    prevGame.current = game;
    if (prev === game || prev.round !== game.round) return;
    const before = new Set(prev.players[HUMAN].hand.map((c) => c.id));
    const added = game.players[HUMAN].hand.filter((c) => !before.has(c.id)).map((c) => c.id);
    if (added.length === 0) return;
    setFresh(new Set(added));
    const t = window.setTimeout(() => setFresh(new Set()), 2500);
    return () => window.clearTimeout(t);
  }, [game]);

  async function act(a: Action): Promise<boolean> {
    const error = await perform(a);
    if (error) {
      flash(error, true);
      return false;
    }
    return true;
  }

  useEffect(() => {
    if (game.phase === 'roundOver' || game.phase === 'gameOver' || game.current !== HUMAN) {
      setSelected([]);
      setStaged([]);
    }
  }, [game.phase, game.current, game.round]);

  // Gleiche Karten liegen als Stapel. Jeder Tipp wählt eine Karte mehr, ist alles gewählt, wird der Stapel abgewählt.
  const tapStack = (group: Card[]) => {
    if (!myTurn) return;
    setSelected((sel) => {
      const free = group.filter((c) => !sel.includes(c.id));
      if (free.length === 0) return sel.filter((id) => !group.some((c) => c.id === id));
      return [...sel, free[free.length - 1].id];
    });
  };

  const onStock = async () => {
    if (!myTurn) return;
    if (game.phase !== 'draw') return flash('Du hast schon gezogen.', true);
    act({ type: 'drawStock' });
  };

  const onPile = async () => {
    if (!myTurn) return;
    if (game.phase !== 'draw') return flash('Du hast schon gezogen.', true);
    // Passende Karten zur obersten Stapelkarte gehen mit ihr zusammen, der Rest wird als eigene Meldungen ausgelegt.
    const top = topDiscard(game);
    const sel = me.hand.filter((c) => selected.includes(c.id));
    let withCards = selected;
    let extra: MeldGroup[] = [];
    if (top && sel.some((c) => !isWild(c) && c.rank !== top.rank)) {
      const matching = sel.filter((c) => !isWild(c) && c.rank === top.rank);
      const wild = matching.length < 2 && !isPileFrozenFor(game, HUMAN) ? sel.find(isWild) : undefined;
      const withSet = [...matching, ...(wild ? [wild] : [])];
      const rest = autoGroup(sel.filter((c) => !withSet.includes(c)), myTeam.melds);
      if (typeof rest === 'string') return flash(rest, true);
      withCards = withSet.map((c) => c.id);
      extra = rest;
    }
    if (await act({ type: 'takePile', withCards, extraMelds: [...staged, ...extra] })) {
      setSelected([]);
      setStaged([]);
    }
  };

  const onMeld = async () => {
    // Gemischte Auswahl wird automatisch nach Rang in mehrere Meldungen aufgeteilt.
    const auto = autoGroup(me.hand.filter((c) => selected.includes(c.id)), myTeam.melds);
    if (typeof auto === 'string') return flash(auto, true);
    const groups = [...staged, ...auto];
    if (groups.length === 0) return flash('Wähle zuerst Karten aus.', true);
    if (await act({ type: 'meld', groups })) {
      setSelected([]);
      setStaged([]);
    }
  };

  const onStage = () => {
    if (selected.length === 0) return flash('Wähle zuerst Karten aus.', true);
    setStaged((s) => [...s, { cardIds: selected }]);
    setSelected([]);
  };

  const onMeldClick = async (m: Meld) => {
    if (!myTurn || game.phase !== 'play' || selected.length === 0) return;
    if (await act({ type: 'meld', groups: [{ cardIds: selected, target: m.rank }] })) setSelected([]);
  };

  const onDiscard = async () => {
    if (selected.length !== 1) return flash('Wähle genau eine Karte zum Abwerfen.', true);
    if (staged.length > 0) return flash('Lege die vorgemerkten Karten zuerst aus oder nimm sie zurück.', true);
    if (await act({ type: 'discard', cardId: selected[0] })) setSelected([]);
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
    else if (game.phase === 'draw') hint = 'Tippe auf den Stock – oder wähle passende Karten und tippe auf den Ablagestapel.';
    else hint = 'Karten wählen (auch mehrere Sorten) und auf dein Feld tippen zum Auslegen – eine Karte wählen und auf den Ablagestapel tippen zum Abwerfen.';
  }

  const onBoardClick = () => {
    if (myTurn && game.phase === 'play' && (selected.length > 0 || staged.length > 0)) onMeld();
  };

  // Im Auslegen-Teil des Zugs wirft ein Tipp auf den Ablagestapel die gewählte Karte ab.
  const onPileTap = () => {
    if (myTurn && game.phase === 'play' && selected.length === 1) return onDiscard();
    onPile();
  };

  const opponents = game.mode === 4 ? [1, 2, 3] : [1];
  const oppTeam = 1 - me.team;
  const status = message ?? (myTurn ? { text: hint, error: false } : null);

  return (
    <div className={`table mode-${game.mode}`}>
      <div className="felt">
        <div className="felt-band" />

        <div className="topleft">
          <button className="round-btn" onClick={onExit} title="Menü">
            ☰
          </button>
          <div className="scorechip">
            <span>Runde {game.round}</span>
            <span className="mine">
              {teamName(game, me.team)} {myTeam.score}
            </span>
            <span className="theirs">
              {teamName(game, oppTeam)} {game.teams[oppTeam].score}
            </span>
            <span className="diff">{botLabel(game)}</span>
          </div>
        </div>

        <div className="opponents">
          {opponents.map((pi) => (
            <Avatar key={pi} game={game} pi={pi} />
          ))}
        </div>

        <div className="boards">
          <MeldBoard
            game={game}
            team={me.team}
            onMeldClick={onMeldClick}
            onBoardClick={onBoardClick}
            clickable={myTurn && game.phase === 'play' && selected.length > 0}
          />
          <div className="piles">
            <div className={`pile discard ${myTurn && game.phase === 'play' && selected.length === 1 ? 'drop' : ''}`} onClick={onPileTap}>
              {top ? (
                <div className="pile-stack">
                  {game.discard.length > 1 && <CardView card={game.discard[game.discard.length - 2]} className="under" />}
                  <CardView card={top} className={myTurn && game.phase === 'draw' && canTakePileAtAll(game) ? 'glow-soft' : ''} />
                </div>
              ) : (
                <div className="card empty" />
              )}
              {game.pileFrozen && (
                <span className="frozen" title="Eingefroren">
                  ❄
                </span>
              )}
              <span className="pile-count">{game.discard.length}</span>
            </div>
            <div className="pile stock" onClick={onStock}>
              {game.stock.length > 0 ? (
                <CardView faceDown className={myTurn && game.phase === 'draw' ? 'glow' : ''} />
              ) : (
                <div className="card empty" />
              )}
              <span className="stock-count">{game.stock.length}</span>
            </div>
          </div>
          <MeldBoard game={game} team={oppTeam} />
          <div className="ticker">
            {status && <div className={`status ${status.error ? 'error' : ''}`}>{status.text}</div>}
            {myTurn && (selected.length > 0 || staged.length > 0 || needsInitial) && (
              <div className="value">
                {[
                  selected.length > 0 || staged.length > 0 ? `Auswahl ${sumValues([...selCards, ...stagedCards])} Pkt.` : '',
                  needsInitial ? `Erstmeldung mind. ${minimum}` : '',
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
            )}
            {game.log.slice(myTurn ? -1 : -2).map((line, i, arr) => (
              <div key={game.log.length - arr.length + i} className={i === arr.length - 1 ? 'last' : 'old'}>
                {line}
              </div>
            ))}
            {myTurn && game.phase === 'draw' && top && (
              <div className="old">
                {!canTakePileAtAll(game)
                  ? 'Stapel gesperrt.'
                  : frozenForMe
                    ? `Stapel eingefroren: zwei natürliche ${rankPlural(top.rank)} nötig.`
                    : 'Stapel offen.'}
              </div>
            )}
          </div>
        </div>

        <div className="bottom">
          <Avatar game={game} pi={HUMAN} />
          <div className="hand-area">
            {staged.length > 0 && (
              <div className="staged">
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
              </div>
            )}
            <div className={`hand ${myTurn ? 'my-turn' : ''}`} style={{ '--n': Math.max(stacks.length, 2) } as React.CSSProperties}>
              {stacks.map((group) => {
                const picked = group.filter((c) => selected.includes(c.id)).length;
                // Gewählte Karten liegen oben auf dem Stapel und heben sich ab.
                const ordered = [...group.filter((c) => !selected.includes(c.id)), ...group.filter((c) => selected.includes(c.id))];
                return (
                  <div
                    key={group[0].id}
                    className={`stack ${picked > 0 ? 'has-selected' : ''}`}
                    style={{ '--k': group.length } as React.CSSProperties}
                    onClick={() => tapStack(group)}
                  >
                    {ordered.map((c, i) => (
                      <CardView
                        key={c.id}
                        card={c}
                        selected={selected.includes(c.id)}
                        className={`${fresh.has(c.id) ? 'fresh' : ''} clickable`}
                        style={{ '--i': group.length - 1 - i } as React.CSSProperties}
                      />
                    ))}
                    {group.length > 1 && (
                      <span className="stack-count">{picked > 0 ? `${picked}/${group.length}` : group.length}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="actions">
            <button disabled={!myTurn || game.phase !== 'play'} onClick={onMeld}>
              Auslegen
            </button>
            <button className="alt" disabled={!myTurn || selected.length === 0} onClick={onStage} title="Mehrere Meldungen auf einmal auslegen (z. B. für die Erstmeldung)">
              Vormerken
            </button>
            <button disabled={!myTurn || game.phase !== 'play'} onClick={onDiscard}>
              Abwerfen
            </button>
            <button className="alt small" disabled={selected.length === 0} onClick={() => setSelected([])} title="Auswahl aufheben">
              ✕ Abwählen
            </button>
          </div>
        </div>
      </div>

      {(game.phase === 'roundOver' || game.phase === 'gameOver') && game.lastRound && (
        <RoundSummary game={game} onNext={() => act({ type: 'nextRound' })} onNewGame={onNewGame} onExit={onExit} />
      )}
    </div>
  );
}


function botLabel(game: GameState): string {
  const bot = game.players.find((p) => !p.isHuman);
  return bot ? DIFFICULTY_LABEL[bot.difficulty] : 'Online';
}

function Avatar({ game, pi }: { game: GameState; pi: number }) {
  const p = game.players[pi];
  const ally = p.team === game.players[HUMAN].team;
  return (
    <div className={`avatar ${game.current === pi && (game.phase === 'draw' || game.phase === 'play') ? 'active' : ''}`}>
      <div className="face">
        <AvatarFace config={p.avatar ?? BOT_AVATARS[pi % BOT_AVATARS.length]} />
      </div>
      <div className={`ribbon ${ally ? 'ally' : 'enemy'}`}>{p.name}</div>
      {pi !== HUMAN && <div className="count">{p.hand.length}</div>}
    </div>
  );
}

/** Punkte der Auslage, wie sie gerade auf dem Tisch liegen (ohne Handkarten und Ausmach-Bonus). */
function boardPoints(t: TeamState): number {
  const cards = t.melds.reduce((s, m) => s + sumValues(m.cards), 0);
  const canastas = t.melds.reduce((s, m) => s + (isCanasta(m) ? (isNaturalCanasta(m) ? 500 : 300) : 0), 0);
  const reds = t.redThrees.length === 4 ? 800 : t.redThrees.length * 100;
  return cards + canastas + (canastas > 0 ? reds : -reds);
}

function MeldBoard({
  game,
  team,
  onMeldClick,
  onBoardClick,
  clickable,
}: {
  game: GameState;
  team: number;
  onMeldClick?: (m: Meld) => void;
  onBoardClick?: () => void;
  clickable?: boolean;
}) {
  const t = game.teams[team];
  const own = team === game.players[HUMAN].team;
  const melds = [...t.melds].sort((a, b) => b.cards.length - a.cards.length || b.rank - a.rank);
  const label = own ? (game.mode === 4 ? 'Unsere Punkte' : 'Deine Punkte') : game.mode === 4 ? 'Gegner Punkte' : `Punkte ${teamName(game, team)}`;
  return (
    <section className={`board ${own ? 'own' : 'opp'} ${clickable ? 'droppable' : ''}`} onClick={onBoardClick}>
      <div className="board-label">
        {label}: {boardPoints(t)} Pkt.
        {t.melds.length === 0 ? (
          <span className="out-need" title="Mindestwert der ersten Auslage">
            Raus mit {initialMeldMinimum(t.score)}
          </span>
        ) : (
          <span className="out-done">✓ draußen</span>
        )}
      </div>
      <div className="board-melds">
        {melds.map((m) => (
          <MeldFan
            key={m.rank}
            meld={m}
            clickable={clickable}
            onClick={
              onMeldClick
                ? (e) => {
                    e.stopPropagation();
                    onMeldClick(m);
                  }
                : undefined
            }
          />
        ))}
        {t.redThrees.length > 0 && (
          <div className="meld reds">
            <div className="meld-cards">
              {t.redThrees.map((c) => (
                <CardView key={c.id} card={c} small />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function MeldFan({ meld, onClick, clickable }: { meld: Meld; onClick?: (e: React.MouseEvent) => void; clickable?: boolean }) {
  const canasta = isCanasta(meld);
  const natural = isNaturalCanasta(meld);
  const cards = [...meld.cards].sort((a, b) => Number(isWild(a)) - Number(isWild(b)));
  const wilds = meld.cards.filter(isWild).length;
  return (
    <div
      className={`meld ${canasta ? (natural ? 'canasta natural' : 'canasta mixed') : ''} ${clickable ? 'target' : ''}`}
      onClick={onClick}
      title={`${rankPlural(meld.rank)}: ${meld.cards.length} Karten, ${wilds} Wildcards`}
    >
      <div className="meld-cards">
        {canasta ? (
          <CardView card={cards[0]} small className={natural ? 'canasta-red' : 'canasta-black'} />
        ) : (
          cards.map((c) => <CardView key={c.id} card={c} small />)
        )}
      </div>
      {canasta && <span className="meld-tag">{meld.cards.length}</span>}
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
  onNewGame?: () => void;
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
              {onNewGame && <button onClick={onNewGame}>Neues Spiel</button>}
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
