import Peer, { type DataConnection } from 'peerjs';
import type { Action, AvatarConfig, Difficulty, GameState, Mode } from '../engine/types';
import { type GuestMessage, type HostMessage, type LobbyInfo, makeView, newRoomCode, peerId } from './protocol';

const BOT_NAMES: Record<Mode, string[]> = { 4: ['', 'Lena', 'Max', 'Jonas'], 2: ['', 'Lena'] };

interface Seat {
  kind: 'host' | 'guest' | 'bot';
  guest?: string;
}

interface GuestConn {
  name: string;
  avatar?: AvatarConfig;
  conn: DataConnection | null;
}

export interface HostSettings {
  mode: Mode;
  difficulty: Difficulty;
  targetScore: number;
}

/** Gastgeber: hält die Verbindungen, verteilt die Plätze und schickt jedem Gast seine Sicht aufs Spiel. */
export class Host {
  readonly code: string;
  readonly hostName: string;
  readonly hostAvatar?: AvatarConfig;
  /** Aussehen der Computer-Spieler pro Platz. */
  botAvatars: AvatarConfig[] = [];
  settings: HostSettings;
  seats: Seat[] = [];
  started = false;
  onChange?: () => void;
  onAction?: (seat: number, action: Action) => string | null;
  onNotice?: (text: string) => void;
  private guests = new Map<string, GuestConn>();
  private lastState: GameState | null = null;

  private constructor(
    private peer: Peer,
    code: string,
    hostName: string,
    settings: HostSettings,
  ) {
    this.code = code;
    this.hostName = hostName;
    this.settings = settings;
    this.resizeSeats();
    peer.on('connection', (conn) => this.accept(conn));
    peer.on('disconnected', () => peer.reconnect());
  }

  static async create(hostName: string, settings: HostSettings, hostAvatar?: AvatarConfig, botAvatars: AvatarConfig[] = []): Promise<Host> {
    for (let attempt = 0; attempt < 4; attempt++) {
      const code = newRoomCode();
      try {
        const peer = await openPeer(peerId(code));
        const host = new Host(peer, code, hostName, settings);
        Object.assign(host, { hostAvatar, botAvatars });
        return host;
      } catch (e) {
        if ((e as { type?: string }).type !== 'unavailable-id') throw e;
      }
    }
    throw new Error('Kein freier Spielcode gefunden.');
  }

  get guestNames(): string[] {
    return [...this.guests.values()].map((g) => g.name);
  }

  isConnected(name: string): boolean {
    return [...this.guests.values()].some((g) => g.name === name && g.conn?.open);
  }

  setSettings(patch: Partial<HostSettings>) {
    this.settings = { ...this.settings, ...patch };
    this.resizeSeats();
    this.changed();
  }

  /** Setzt einen Gast (per Name) oder die KI auf einen Platz. */
  assign(seat: number, guest: string | null) {
    if (seat === 0 || this.started) return;
    if (guest) {
      this.seats.forEach((s, i) => {
        if (s.guest === guest) this.seats[i] = { kind: 'bot' };
      });
      this.seats[seat] = { kind: 'guest', guest };
    } else {
      this.seats[seat] = { kind: 'bot' };
    }
    this.changed();
  }

  /** Namen, Mensch/KI und Aussehen pro Platz für newGame. */
  start(): { names: string[]; humans: boolean[]; avatars: (AvatarConfig | undefined)[] } {
    this.started = true;
    const names = this.seats.map((s, i) =>
      s.kind === 'host' ? this.hostName : s.kind === 'guest' ? s.guest! : `${BOT_NAMES[this.settings.mode][i]} 🤖`,
    );
    const humans = this.seats.map((s) => s.kind !== 'bot');
    for (const g of this.guests.values()) {
      if (!this.seats.some((s) => s.guest === g.name)) this.send(g, { t: 'closed', reason: 'Alle Plätze sind vergeben.' });
    }
    const avatars = this.seats.map((_, i) => this.seatAvatar(i));
    this.changed();
    return { names, humans, avatars };
  }

  /** Schickt jedem verbundenen Gast seine eigene Sicht. */
  broadcast(state: GameState) {
    this.lastState = state;
    this.seats.forEach((s, i) => {
      const g = s.guest ? this.findGuest(s.guest) : undefined;
      if (g) this.send(g, { t: 'state', view: makeView(state, i) });
    });
  }

  lobby(): LobbyInfo {
    return {
      code: this.code,
      mode: this.settings.mode,
      difficulty: this.settings.difficulty,
      targetScore: this.settings.targetScore,
      seats: this.seats.map((s, i) => ({
        kind: s.kind,
        name: s.kind === 'host' ? this.hostName : s.kind === 'guest' ? s.guest! : `${BOT_NAMES[this.settings.mode][i]} 🤖`,
        avatar: this.seatAvatar(i),
      })),
      waiting: this.guestNames.filter((n) => !this.seats.some((s) => s.guest === n)),
    };
  }

  close() {
    for (const g of this.guests.values()) this.send(g, { t: 'closed', reason: 'Der Gastgeber hat das Spiel beendet.' });
    setTimeout(() => this.peer.destroy(), 200);
  }

  private resizeSeats() {
    const n = this.settings.mode;
    const old = this.seats;
    this.seats = Array.from({ length: n }, (_, i) => (i === 0 ? { kind: 'host' } : old[i] ?? { kind: 'bot' }));
    // Gäste, deren Platz weggefallen ist, rücken auf freie Plätze nach.
    for (const s of old.slice(n)) {
      const free = this.seats.findIndex((x) => x.kind === 'bot');
      if (s.guest && free >= 0) this.seats[free] = { kind: 'guest', guest: s.guest };
    }
  }

  private seatAvatar(i: number): AvatarConfig | undefined {
    const s = this.seats[i];
    if (s.kind === 'host') return this.hostAvatar;
    if (s.kind === 'guest') return this.findGuest(s.guest!)?.avatar;
    return this.botAvatars[i];
  }

  private findGuest(name: string): GuestConn | undefined {
    return [...this.guests.values()].find((g) => g.name === name);
  }

  private seatOf(name: string): number {
    return this.seats.findIndex((s) => s.guest === name);
  }

  private accept(conn: DataConnection) {
    conn.on('data', (raw) => this.receive(conn, raw as GuestMessage));
    conn.on('close', () => this.drop(conn));
    conn.on('error', () => this.drop(conn));
  }

  private receive(conn: DataConnection, msg: GuestMessage) {
    if (msg.t === 'hello') return this.hello(conn, msg.name, msg.avatar);
    const g = this.guests.get(conn.peer);
    if (!g || msg.t !== 'action') return;
    const seat = this.seatOf(g.name);
    let error: string | null = 'Du sitzt an keinem Platz.';
    if (seat >= 0 && this.onAction) error = this.onAction(seat, msg.action);
    this.send(g, { t: 'result', id: msg.id, error });
  }

  private hello(conn: DataConnection, rawName: string, avatar?: AvatarConfig) {
    let name = (rawName || 'Gast').trim().slice(0, 14) || 'Gast';
    // Wiederverbinden: Gast mit gleichem Namen, dessen Verbindung abgerissen ist, bekommt seinen Platz zurück.
    const old = [...this.guests.entries()].find(([, g]) => g.name === name && !g.conn?.open);
    if (old) {
      this.guests.delete(old[0]);
      this.onNotice?.(`${name} ist wieder verbunden.`);
    } else {
      if (this.started) return this.send({ name, conn }, { t: 'closed', reason: 'Das Spiel läuft schon.' });
      const taken = new Set([this.hostName, ...this.guestNames]);
      for (let k = 2; taken.has(name); k++) name = `${rawName.trim().slice(0, 12)} ${k}`;
    }
    const g: GuestConn = { name, conn, avatar: avatar ?? old?.[1].avatar };
    this.guests.set(conn.peer, g);
    if (!this.started && !old) {
      // Automatisch auf den ersten freien Platz setzen (zu viert zuerst als Partner).
      const order = this.settings.mode === 4 ? [2, 1, 3] : [1];
      const free = order.find((i) => this.seats[i].kind === 'bot');
      if (free !== undefined) this.seats[free] = { kind: 'guest', guest: name };
    }
    this.changed();
    if (this.started && this.lastState) {
      const seat = this.seatOf(name);
      if (seat >= 0) this.send(g, { t: 'state', view: makeView(this.lastState, seat) });
    }
  }

  private drop(conn: DataConnection) {
    const g = this.guests.get(conn.peer);
    if (!g || g.conn !== conn) return;
    if (this.started) {
      g.conn = null;
      this.onNotice?.(`${g.name} hat die Verbindung verloren.`);
    } else {
      this.guests.delete(conn.peer);
      const seat = this.seatOf(g.name);
      if (seat >= 0) this.seats[seat] = { kind: 'bot' };
    }
    this.changed();
  }

  private send(g: GuestConn, msg: HostMessage) {
    if (g.conn?.open) g.conn.send(msg);
  }

  private changed() {
    if (!this.started) {
      for (const g of this.guests.values()) {
        const seat = this.seatOf(g.name);
        this.send(g, { t: 'lobby', lobby: this.lobby(), seat: seat >= 0 ? seat : null });
      }
    }
    this.onChange?.();
  }
}

export function openPeer(id?: string): Promise<Peer> {
  return new Promise((resolve, reject) => {
    const peer = id ? new Peer(id) : new Peer();
    const timer = setTimeout(() => {
      peer.destroy();
      reject(new Error('Keine Verbindung zum Vermittlungsdienst. Bist du online?'));
    }, 12000);
    peer.on('open', () => {
      clearTimeout(timer);
      resolve(peer);
    });
    peer.on('error', (e) => {
      clearTimeout(timer);
      peer.destroy();
      reject(e);
    });
  });
}
