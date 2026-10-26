# Canasta

Klassisches Canasta als Offline-Web-App (PWA) gegen den Computer – 2 oder 4 Spieler, drei Schwierigkeitsstufen.

## Befehle

```bash
npm install        # einmalig
npm run dev        # Entwicklungsserver auf http://localhost:5173
npm test           # Regeltests + Bot-gegen-Bot-Simulation
npm run build      # fertige App nach dist/ (inkl. Service Worker für offline)
npm run preview    # gebaute App lokal ansehen
```

## Aufbau

- `src/engine/` – Regeln, Spielablauf und Wertung (rein, ohne UI, deterministisch per Seed)
- `src/ai/` – Bots: `bot.ts` (Zugwahl), `difficulty.ts` (Stärke-Parameter je Stufe), `memory.ts` (Kartengedächtnis)
- `src/ui/` – React-Oberfläche (Menü, Spieltisch, Abrechnung, Regeln, Online-Lobby)
- `src/online/` – Online-Modus: Gastgeber (`host.ts`) und Gast (`guest.ts`) per PeerJS, `protocol.ts` mit den Nachrichten und der gefilterten Spieler-Sicht
- `tests/` – Regeltests und Simulation (prüft auch, dass Schwer > Mittel > Leicht)

## Online spielen

Peer-to-Peer über den kostenlosen PeerJS-Vermittlungsdienst – kein eigener Server. Der Gastgeber erstellt ein Spiel und teilt Code oder Link; sein Gerät rechnet das Spiel und die Bots und schickt jedem Gast nur dessen eigene Karten. Bricht die Verbindung eines Gasts ab, kann er mit gleichem Namen und Code wieder beitreten.

## Hausregeln

- Erstmeldung bei negativem Stand: 30 Punkte
- Rote Dreien zählen minus, wenn das Team keinen Canasta hat
- Handcanasta (in einem Zug ausmachen, bevor irgendwer ausgelegt hat): 1000 Punkte
- Kein „Partner, darf ich ausmachen?“
- Auch zu zweit: eine Karte ziehen, ein Canasta reicht zum Ausmachen
