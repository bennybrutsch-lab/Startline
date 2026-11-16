# Startline

Eine Web-App für junge Leute, die etwas Eigenes aufbauen wollen und nicht wissen, womit.
24 Fragen, drei Wege, ein Plan, jeden Tag eine Aufgabe.

Stand: MVP, Etappe 3 mit neuem Aufbau. Nach dem Anmelden kommt eine Startseite mit den Bereichen Heute, Plan und Mentor. Es funktionieren Konto, die 24 Fragen mit Einleitung, die drei Vorschläge, die Wahl eines Weges, die Vertiefungsfragen, der persönliche Plan, die Aufgabe von heute mit Abhaken und das Einrichten des Mentors.
Das Aussehen ist bewusst schlicht, das Design kommt später.

## Was wo liegt

| Ordner oder Datei | Inhalt |
|---|---|
| `public/` | Was der Browser zeigt: Seite, Aussehen, Programm im Browser |
| `src/worker.js` | Der Server. Beantwortet alle Adressen, die mit `/api/` beginnen |
| `src/konto.js` | Registrieren, Anmelden, Passwörter sicher speichern |
| `src/punkte.js` | Rechnet aus den Antworten die drei Vorschläge aus, ohne KI |
| `src/plan.js` | Passt das Gerüst eines Weges an die Person an, ohne KI |
| `daten/fragen.json` | Die 24 Fragen, die Punkte und die sechs Richtungen |
| `daten/mentor.json` | Die Stile, in denen der Mentor reden kann |
| `daten/einfuehrung.json` | Die Seiten der Einführung beim ersten Anmelden |
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

Nach jedem `git pull` einmal `npm run db:lokal` ausführen. Der Befehl legt neu hinzugekommene Tabellen an und lässt vorhandene Daten in Ruhe.

Unter Windows kann die PowerShell `npm` sperren. Dann überall `npm.cmd` statt `npm` schreiben.

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

Gespräch mit dem Mentor, Bezahlung, Altersprüfung, Englisch, Design.
Vor einem öffentlichen Start fehlen außerdem Impressum, Datenschutzerklärung und eine Begrenzung der Anmeldeversuche.
