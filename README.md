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
- `src/ui/` – React-Oberfläche (Menü, Spieltisch, Abrechnung, Regeln)
- `tests/` – Regeltests und Simulation (prüft auch, dass Schwer > Mittel > Leicht)

## Hausregeln

- Erstmeldung bei negativem Stand: 30 Punkte
- Rote Dreien zählen minus, wenn das Team keinen Canasta hat
- Handcanasta (in einem Zug ausmachen, bevor irgendwer ausgelegt hat): 1000 Punkte
- Kein „Partner, darf ich ausmachen?“
