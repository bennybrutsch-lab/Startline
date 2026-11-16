# Startline

Eine Web-App für junge Leute, die etwas Eigenes aufbauen wollen und nicht wissen, womit.
25 Fragen, drei Wege, ein Plan, jeden Tag eine Aufgabe.

Stand: MVP, Etappe 2. Es funktionieren Konto, Anmeldung, die 25 Fragen, die drei Vorschläge, die Wahl eines Weges, die Vertiefungsfragen und der persönliche Plan.
Das Aussehen ist bewusst schlicht, das Design kommt später.

## Was wo liegt

| Ordner oder Datei | Inhalt |
|---|---|
| `public/` | Was der Browser zeigt: Seite, Aussehen, Programm im Browser |
| `src/worker.js` | Der Server. Beantwortet alle Adressen, die mit `/api/` beginnen |
| `src/konto.js` | Registrieren, Anmelden, Passwörter sicher speichern |
| `src/punkte.js` | Rechnet aus den Antworten die drei Vorschläge aus, ohne KI |
| `src/plan.js` | Passt das Gerüst eines Weges an die Person an, ohne KI |
| `daten/fragen.json` | Die 25 Fragen, die Punkte und die sechs Richtungen |
| `daten/weg-websites.json` | Der 30-Tage-Plan für „Websites für Betriebe vor Ort“ |
| `schema.sql` | Die Tabellen der Datenbank |
| `tests/` | Automatische Prüfungen |
| `marke/` | Logo-Dateien |

Fragen und Plan stehen in `daten/`. Wer dort Texte oder Punkte ändert, muss keinen Code anfassen.

## Lokal starten

Voraussetzung: Node.js ist installiert.

```bash
npm install
```

```bash
npm run db:lokal
```

```bash
npm run dev
```

Danach läuft die App unter http://localhost:8787. Die lokale Datenbank liegt im Ordner `.wrangler` und wird nicht hochgeladen.

## Tests

```bash
npm test
```

## Online stellen

Das geht nur vom eigenen Rechner aus, mit einem Cloudflare-Konto.

1. Anmelden:

```bash
npx wrangler login
```

2. Datenbank anlegen:

```bash
npx wrangler d1 create startline-db
```

3. Die ausgegebene `database_id` in `wrangler.jsonc` eintragen, anstelle der Nullen.

4. Tabellen online anlegen:

```bash
npx wrangler d1 execute startline-db --remote --file=schema.sql
```

5. Hochladen:

```bash
npm run deploy
```

## Noch nicht enthalten

Aufgabe von heute mit Abhaken, Mentor-Chat, Bezahlung, Altersprüfung, Englisch, Design.
Vor einem öffentlichen Start fehlen außerdem Impressum, Datenschutzerklärung und eine Begrenzung der Anmeldeversuche.
