import type Peer from 'peerjs';
import type { DataConnection } from 'peerjs';
import type { Action, AvatarConfig, GameState } from '../engine/types';
import { openPeer } from './host';
import { type GuestMessage, type HostMessage, type LobbyInfo, peerId } from './protocol';

/** Gast: verbindet sich per Code mit dem Gastgeber und schickt nur seine Aktionen. */
export class GuestClient {
  lobby: LobbyInfo | null = null;
  seat: number | null = null;
  view: GameState | null = null;
  closedReason: string | null = null;
  onChange?: () => void;
  private nextId = 1;
  private pending = new Map<number, (error: string | null) => void>();

  private constructor(
    private peer: Peer,
    private conn: DataConnection,
  ) {
    conn.on('data', (raw) => this.receive(raw as HostMessage));
    conn.on('close', () => this.closed('Die Verbindung zum Gastgeber wurde getrennt.'));
    conn.on('error', () => this.closed('Die Verbindung zum Gastgeber wurde getrennt.'));
  }

  static async join(code: string, name: string, avatar?: AvatarConfig): Promise<GuestClient> {
    const peer = await openPeer();
    return new Promise((resolve, reject) => {
      const conn = peer.connect(peerId(code), { reliable: true, serialization: 'json' });
      const fail = (msg: string) => {
        clearTimeout(timer);
        peer.destroy();
        reject(new Error(msg));
      };
      const timer = setTimeout(() => fail('Spiel nicht gefunden. Stimmt der Code?'), 12000);
      peer.on('error', (e) => fail((e as { type?: string }).type === 'peer-unavailable' ? 'Spiel nicht gefunden. Stimmt der Code?' : 'Verbindung fehlgeschlagen.'));
      conn.on('open', () => {
        clearTimeout(timer);
        const client = new GuestClient(peer, conn);
        client.post({ t: 'hello', name, avatar });
        resolve(client);
      });
    });
  }

  /** Schickt eine Aktion; liefert die Fehlermeldung des Gastgebers oder null. */
  act(action: Action): Promise<string | null> {
    if (!this.conn.open) return Promise.resolve('Keine Verbindung zum Gastgeber.');
    const id = this.nextId++;
    return new Promise((resolve) => {
      this.pending.set(id, resolve);
      this.post({ t: 'action', id, action });
      setTimeout(() => {
        if (this.pending.delete(id)) resolve('Der Gastgeber antwortet nicht.');
      }, 10000);
    });
  }

  leave() {
    this.conn.close();
    this.peer.destroy();
  }

  private post(msg: GuestMessage) {
    this.conn.send(msg);
  }

  private receive(msg: HostMessage) {
    if (msg.t === 'lobby') {
      this.lobby = msg.lobby;
      this.seat = msg.seat;
    } else if (msg.t === 'state') {
      this.view = msg.view;
    } else if (msg.t === 'result') {
      this.pending.get(msg.id)?.(msg.error);
      this.pending.delete(msg.id);
    } else if (msg.t === 'closed') {
      return this.closed(msg.reason);
    }
    this.onChange?.();
  }

  private closed(reason: string) {
    if (this.closedReason) return;
    this.closedReason = reason;
    this.onChange?.();
  }
}
