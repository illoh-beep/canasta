import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { DIFFICULTY_LABEL } from '../ai/difficulty';
import { newGame } from '../engine/game';
import type { Difficulty, GameState, Mode } from '../engine/types';
import { GuestClient } from '../online/guest';
import { Host } from '../online/host';
import { type LobbyInfo, joinLink, makeView, normalizeCode } from '../online/protocol';
import type { Settings } from '../storage';
import { AvatarFace, BOT_AVATARS, loadAvatar } from './avatar';
import { Game } from './Game';
import { useEngine } from './useEngine';

const NAME_KEY = 'canasta.name.v1';

function loadName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

function saveName(name: string) {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    // egal
  }
}

type Stage =
  | { kind: 'start' }
  | { kind: 'busy'; text: string }
  | { kind: 'host'; host: Host; game: GameState | null }
  | { kind: 'guest'; guest: GuestClient };

interface Props {
  settings: Settings;
  joinCode: string | null;
  onExit: () => void;
}

export function Online({ settings, joinCode, onExit }: Props) {
  const [stage, setStage] = useState<Stage>({ kind: 'start' });
  const [name, setName] = useState(loadName);
  const [code, setCode] = useState(normalizeCode(joinCode ?? ''));
  const [error, setError] = useState<string | null>(null);
  const [, rerender] = useReducer((x: number) => x + 1, 0);

  // Verbindungen erst beim Verlassen des Online-Bereichs schließen.
  const stageRef = useRef(stage);
  stageRef.current = stage;
  useEffect(
    () => () => {
      const st = stageRef.current;
      if (st.kind === 'host') st.host.close();
      if (st.kind === 'guest') st.guest.leave();
    },
    [],
  );

  const playerName = () => {
    const n = name.trim();
    if (!n) {
      setError('Gib zuerst deinen Namen ein.');
      return null;
    }
    saveName(n);
    return n;
  };

  const create = async () => {
    const n = playerName();
    if (!n) return;
    setError(null);
    setStage({ kind: 'busy', text: 'Spiel wird erstellt …' });
    try {
      const host = await Host.create(
        n,
        { mode: settings.mode, difficulty: settings.difficulty, targetScore: settings.targetScore },
        loadAvatar(),
        BOT_AVATARS,
      );
      host.onChange = rerender;
      setStage({ kind: 'host', host, game: null });
    } catch (e) {
      setError((e as Error).message || 'Spiel konnte nicht erstellt werden.');
      setStage({ kind: 'start' });
    }
  };

  const join = async () => {
    const n = playerName();
    if (!n) return;
    if (code.length !== 5) return setError('Der Code hat 5 Zeichen.');
    setError(null);
    setStage({ kind: 'busy', text: `Verbinde mit Spiel ${code} …` });
    try {
      const guest = await GuestClient.join(code, n, loadAvatar());
      guest.onChange = rerender;
      setStage({ kind: 'guest', guest });
    } catch (e) {
      setError((e as Error).message);
      setStage({ kind: 'start' });
    }
  };

  if (stage.kind === 'host' && stage.game) {
    return <HostGame host={stage.host} initial={stage.game} fast={settings.fast} onExit={onExit} />;
  }
  if (stage.kind === 'guest' && stage.guest.view && !stage.guest.closedReason) {
    return <Game game={stage.guest.view} act={(a) => stage.guest.act(a)} onExit={onExit} />;
  }

  return (
    <div className="menu">
      <h1 className="small-title">🌐 Online</h1>

      {stage.kind === 'start' && (
        <>
          <div className="menu-card">
            <label>Dein Name</label>
            <div className="name-row">
              <span className="me-face small">
                <AvatarFace config={loadAvatar()} />
              </span>
              <input className="text" value={name} maxLength={14} placeholder="z. B. Felix" onChange={(e) => setName(e.target.value)} />
            </div>
            <p className="hint">Deinen Charakter stellst du im Hauptmenü unter „Mein Charakter“ zusammen.</p>
          </div>
          <div className="menu-card">
            <label>Spiel beitreten</label>
            <input
              className="text code"
              value={code}
              placeholder="CODE"
              inputMode="text"
              autoCapitalize="characters"
              onChange={(e) => setCode(normalizeCode(e.target.value))}
            />
            <button className="big primary" onClick={join}>
              Beitreten
            </button>
          </div>
          <div className="menu-card">
            <label>Eigenes Spiel</label>
            <p className="hint">Du bekommst einen Code für deine Freunde. Leere Plätze übernimmt der Computer.</p>
            <button className="big" onClick={create}>
              Spiel erstellen
            </button>
          </div>
        </>
      )}

      {stage.kind === 'busy' && <div className="menu-card center-text">{stage.text}</div>}

      {stage.kind === 'host' && <HostLobby host={stage.host} onStart={(game) => setStage({ ...stage, game })} />}

      {stage.kind === 'guest' && <GuestLobby guest={stage.guest} />}

      {error && <div className="error-box">{error}</div>}

      <button className="ghost" onClick={onExit}>
        ← Zurück zum Menü
      </button>
    </div>
  );
}

function SeatList({ lobby, renderSeat }: { lobby: LobbyInfo; renderSeat: (i: number) => React.ReactNode }) {
  const label = (i: number) => {
    if (lobby.mode === 2) return i === 0 ? 'Gastgeber' : 'Gegner';
    return i === 0 ? 'Team A' : i === 2 ? 'Team A (Partner)' : 'Team B';
  };
  return (
    <div className="seats">
      {lobby.seats.map((s, i) => (
        <div key={i} className={`seat-row ${lobby.mode === 4 && i % 2 === 1 ? 'team-b' : 'team-a'}`}>
          <span className="me-face tiny">
            <AvatarFace config={s.avatar} />
          </span>
          <span className="seat-label">{label(i)}</span>
          {renderSeat(i) ?? <span className="seat-name">{s.name}</span>}
        </div>
      ))}
    </div>
  );
}

function HostLobby({ host, onStart }: { host: Host; onStart: (g: GameState) => void }) {
  const lobby = host.lobby();
  const [copied, setCopied] = useState(false);
  const link = joinLink(host.code);

  const share = async () => {
    const text = `Spiel Canasta mit mir! Code: ${host.code}`;
    try {
      if (navigator.share) await navigator.share({ title: 'Canasta', text, url: link });
      else {
        await navigator.clipboard.writeText(`${text}\n${link}`);
        setCopied(true);
      }
    } catch {
      // Teilen abgebrochen
    }
  };

  const start = () => {
    const seatsInfo = host.start();
    const { names, humans } = seatsInfo;
    const s = host.settings;
    const { avatars } = seatsInfo;
    onStart(newGame({ mode: s.mode, difficulty: s.difficulty, targetScore: s.targetScore, names, humans, avatars }));
  };

  return (
    <>
      <div className="menu-card">
        <label>Code für deine Freunde</label>
        <div className="room-code">{host.code}</div>
        <button onClick={share}>{copied ? 'Link kopiert ✓' : '🔗 Link teilen'}</button>
        <p className="hint">Freunde öffnen den Link oder geben den Code unter „Online → Beitreten“ ein. Lass diese Seite offen.</p>
      </div>

      <div className="menu-card">
        <label>Spieler</label>
        <div className="segmented">
          {([2, 4] as Mode[]).map((m) => (
            <button key={m} className={lobby.mode === m ? 'on' : ''} onClick={() => host.setSettings({ mode: m })}>
              {m === 2 ? '1 gegen 1' : '2 gegen 2'}
            </button>
          ))}
        </div>
        <label>Plätze</label>
        <SeatList
          lobby={lobby}
          renderSeat={(i) =>
            i === 0 ? null : (
              <select
                className="seat-select"
                value={host.seats[i].guest ?? ''}
                onChange={(e) => host.assign(i, e.target.value || null)}
              >
                <option value="">{lobby.seats[i].kind === 'bot' ? lobby.seats[i].name : 'Computer 🤖'}</option>
                {host.guestNames.map((g) => (
                  <option key={g} value={g}>
                    {g}
                    {host.isConnected(g) ? '' : ' (getrennt)'}
                  </option>
                ))}
              </select>
            )
          }
        />
        {lobby.waiting.length > 0 && <p className="hint">Ohne Platz: {lobby.waiting.join(', ')}</p>}
        <label>Computer-Stärke</label>
        <div className="segmented">
          {(['easy', 'medium', 'hard'] as Difficulty[]).map((d) => (
            <button key={d} className={lobby.difficulty === d ? 'on' : ''} onClick={() => host.setSettings({ difficulty: d })}>
              {DIFFICULTY_LABEL[d]}
            </button>
          ))}
        </div>
        <label>Spielziel</label>
        <div className="segmented">
          {[1500, 3000, 5000].map((t) => (
            <button key={t} className={lobby.targetScore === t ? 'on' : ''} onClick={() => host.setSettings({ targetScore: t })}>
              {t}
            </button>
          ))}
        </div>
        <button className="big primary" onClick={start}>
          Spiel starten
        </button>
      </div>
    </>
  );
}

function GuestLobby({ guest }: { guest: GuestClient }) {
  if (guest.closedReason) return <div className="error-box">{guest.closedReason}</div>;
  const lobby = guest.lobby;
  if (!lobby) return <div className="menu-card center-text">Verbunden – warte auf den Gastgeber …</div>;
  return (
    <div className="menu-card">
      <label>
        Spiel {lobby.code} · {lobby.mode === 2 ? '1 gegen 1' : '2 gegen 2'} · bis {lobby.targetScore}
      </label>
      <SeatList lobby={lobby} renderSeat={(i) => (i === guest.seat ? <span className="seat-name you">{lobby.seats[i].name} (du)</span> : null)} />
      <p className="hint center-text">
        {guest.seat === null ? 'Du hast noch keinen Platz – der Gastgeber teilt die Plätze ein.' : 'Warte, bis der Gastgeber das Spiel startet …'}
      </p>
    </div>
  );
}

function HostGame({ host, initial, fast, onExit }: { host: Host; initial: GameState; fast: boolean; onExit: () => void }) {
  const [notice, setNotice] = useState<{ text: string } | null>(null);
  const { game, act, ref } = useEngine(initial, fast, (next) => host.broadcast(next));

  useEffect(() => {
    host.broadcast(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    host.onAction = (seat, a) => {
      if (a.type !== 'nextRound' && ref.current.current !== seat) return 'Du bist nicht am Zug.';
      return act(a);
    };
    host.onNotice = (text) => setNotice({ text });
  }, [host, act, ref]);

  const view = useMemo(() => makeView(game, 0, false), [game]);
  return <Game game={view} act={act} onExit={onExit} notice={notice} />;
}
