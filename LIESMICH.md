# Startline

Eine Web-App für junge Leute, die etwas Eigenes aufbauen wollen und nicht wissen, womit.
26 Fragen, drei Vorschläge aus 26 Wegen, ein Plan, jeden Tag eine Aufgabe.

Stand: MVP komplett. Nach dem Anmelden kommt eine kurze Einführung, dann die Startseite mit den Bereichen Heute, Plan und Mentor. Es funktionieren Konto, die 26 Fragen, die drei Vorschläge aus 26 Wegen, die Wahl eines Weges, die Vertiefungsfragen, der persönliche Plan, die Aufgabe von heute mit Abhaken und das Gespräch mit dem Mentor.
Der Weg „Websites mit KI für Läden“ hat einen handgeschriebenen Plan. Für die anderen 25 Wege schreibt die KI den Plan für jede Person einzeln. Dafür braucht die App den Schlüssel für Claude. Ohne Schlüssel tragen diese Wege die Marke „Plan kommt bald“.
Das Aussehen ist bewusst schlicht, das Design kommt später.

## Was wo liegt

| Ordner oder Datei | Inhalt |
|---|---|
| `public/` | Was der Browser zeigt: Seite, Aussehen, Programm im Browser |
| `src/worker.js` | Der Server. Beantwortet alle Adressen, die mit `/api/` beginnen |
| `src/konto.js` | Registrieren, Anmelden, Passwörter sicher speichern |
| `src/punkte.js` | Rechnet aus den Antworten das Profil der Person und daraus die drei Vorschläge aus, ohne KI |
| `src/plan.js` | Passt den handgeschriebenen Plan des Website-Wegs an die Person an, ohne KI |
| `src/plan-ki.js` | Lässt die KI für die anderen Wege einen Plan für 30 Tage schreiben und prüft ihn |
| `src/mentor.js` | Der Mentor: Regeln für die KI, was er über die Person weiß, Aufruf von Claude |
| `daten/fragen.json` | Die 26 Fragen und die Eigenschaften, die jede Antwort sammelt |
| `daten/wege.json` | Die 26 Wege mit Steckbrief und Profil |
| `daten/mentor.json` | Die Stile, in denen der Mentor reden kann |
| `daten/einfuehrung.json` | Die Seiten der Einführung beim ersten Anmelden |
| `daten/weg-websites.json` | Der handgeschriebene 30-Tage-Plan für „Websites mit KI für Läden“ |
| `schema.sql` | Die Tabellen der Datenbank |
| `tests/` | Automatische Prüfungen |
| `marke/` | Logo-Dateien |

Fragen, Wege und Plan stehen in `daten/`. Wer dort Texte oder Werte ändert, muss keinen Code anfassen.

## So entstehen die drei Vorschläge

1. Jede Antwort sammelt Eigenschaften: Kamera, Schnitt, Design, Technik, Verkaufen, Kunden, Eigenes bauen, Tempo, Geduld, Community, Schreiben, Startgeld. Manche Antworten ziehen auch etwas ab, zum Beispiel „Nein“ bei der Kamera.
2. Daraus entsteht das Profil der Person, pro Eigenschaft ein Wert zwischen -1 und 1.
3. Jeder Weg hat in `daten/wege.json` ein eigenes Profil mit Gewichten von 1 bis 3. Ein negatives Gewicht heißt: Der Weg passt besser zu Leuten ohne diese Eigenschaft.
4. Die App vergleicht beide Profile. Wege aus dem Bereich, den die Person bei „Welcher Bereich reizt dich am meisten?“ wählt, bekommen einen kleinen Vorsprung.
5. Vorgeschlagen werden die zwei besten Wege und dazu der beste aus einem anderen Bereich. Wer nur ein Handy hat, bekommt keinen Weg, der einen Laptop braucht.

Die Nummern der Fragen bleiben fest, auch wenn Fragen umsortiert werden. Gespeicherte Antworten und die Regeln in `src/plan.js` beziehen sich darauf. Deshalb stehen die zwei neuen Fragen mit den Nummern 25 und 26 mitten in ihren Abschnitten.

Jeder Steckbrief in `daten/wege.json` enthält Beschreibung, einen ehrlichen Satz, rechtliche Hinweise, drei Vertiefungsfragen und vier Etappen mit Ziel und je drei Meilensteinen. Die rechtlichen Hinweise sind eine erste Orientierung und keine Rechtsberatung. Vor einem öffentlichen Start sollte sie jemand prüfen, der sich auskennt.

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

## Den Mentor verbinden

Der Mentor antwortet mit Claude von Anthropic. Dafür braucht die App einen Schlüssel.

1. Auf `platform.claude.com` ein Konto anlegen, Guthaben aufladen (5 € reichen zum Testen) und unter „API Keys“ einen Schlüssel erstellen.
2. Im Projektordner eine Datei `.dev.vars` anlegen mit dieser einen Zeile:

```
ANTHROPIC_API_KEY=hier-den-schluessel-einfuegen
```

3. Die App neu starten.

Die Datei `.dev.vars` wird nie zu GitHub hochgeladen. Den Schlüssel niemals in den Code schreiben.
Online wird der Schlüssel so hinterlegt:

```bash
npx wrangler secret put ANTHROPIC_API_KEY
```

Ohne Schlüssel läuft die App trotzdem. Der Mentor sagt dann, dass er noch nicht verbunden ist.

### Pläne für die neuen Wege

Mit Schlüssel lassen sich alle 26 Wege wählen. Bei den 25 neuen Wegen läuft es so:

1. Die Person wählt den Weg und beantwortet seine drei Vertiefungsfragen. Darüber stehen die rechtlichen Hinweise aus dem Steckbrief.
2. Die KI bekommt den Steckbrief des Weges, alle Antworten der Person und die Regeln aus `src/plan-ki.js`. Sie schreibt einen Plan für 30 Tage in einem festen Format. Das dauert etwa ein bis zwei Minuten.
3. Die App prüft den Plan, bevor sie ihn speichert: genau 30 Tage, jeder Tag mit Titel, ein bis fünf Schritten, Dauer und Fertig-Kriterium. Besteht der Plan die Prüfung nicht, gibt es genau einen zweiten Versuch. Danach erscheint eine Fehlermeldung, und nichts wird gespeichert.
4. Einiges legt die App selbst fest, nicht die KI: zu welcher Etappe ein Tag gehört, dass keine Aufgabe länger dauert, als die Person am Tag Zeit hat, und dass unter 18 das Gespräch mit den Eltern im Plan steht.

Der Plan wird einmal geschrieben und dann gespeichert. Kostenbremse: höchstens 3 KI-Pläne pro Nutzer und Tag (`MAX_PLAENE_PRO_TAG` in `src/plan-ki.js`).

Mit Schlüssel schreibt die KI außerdem die Aufgabe jedes Tages persönlich um, sobald sie dran ist. Grundlage ist immer die geprüfte Vorlage aus `daten/`. Die angepasste Fassung wird gespeichert und trägt in der App die Marke „Für dich angepasst“. Klappt das Anpassen nicht, erscheint einfach die Vorlage.

Kostenbremse: höchstens 30 Nachrichten pro Nutzer und Tag (`MAX_PRO_TAG` in `src/mentor.js`).

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

Bezahlung, Altersprüfung, Englisch, Design.
Vor einem öffentlichen Start fehlen außerdem Impressum, Datenschutzerklärung und eine Begrenzung der Anmeldeversuche.
