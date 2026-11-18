-- Tabellen der Startline-App. Jede Tabelle ist wie ein Blatt in einer Tabellenkalkulation.

-- Wer ein Konto hat. Das Passwort wird nie lesbar gespeichert, nur als Hash.
CREATE TABLE IF NOT EXISTS nutzer (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  pass_hash TEXT NOT NULL,
  salz TEXT NOT NULL,
  erstellt TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Wer gerade angemeldet ist. Der Browser bekommt nur das zufällige Kennzeichen.
CREATE TABLE IF NOT EXISTS sitzungen (
  kennzeichen TEXT PRIMARY KEY,
  nutzer_id INTEGER NOT NULL REFERENCES nutzer(id) ON DELETE CASCADE,
  ablauf TEXT NOT NULL
);

-- Die Antworten auf die 26 Fragen. Pro Nutzer und Frage eine Zeile.
CREATE TABLE IF NOT EXISTS antworten (
  nutzer_id INTEGER NOT NULL REFERENCES nutzer(id) ON DELETE CASCADE,
  frage_nr INTEGER NOT NULL,
  antwort INTEGER NOT NULL,
  PRIMARY KEY (nutzer_id, frage_nr)
);

-- Welchen Weg jemand gewählt hat.
CREATE TABLE IF NOT EXISTS wege (
  nutzer_id INTEGER PRIMARY KEY REFERENCES nutzer(id) ON DELETE CASCADE,
  richtung TEXT NOT NULL,
  gewaehlt_am TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Die Antworten auf die Vertiefungsfragen des gewählten Weges.
CREATE TABLE IF NOT EXISTS vertiefung (
  nutzer_id INTEGER NOT NULL REFERENCES nutzer(id) ON DELETE CASCADE,
  frage_nr INTEGER NOT NULL,
  antwort INTEGER NOT NULL,
  PRIMARY KEY (nutzer_id, frage_nr)
);

-- Der persönliche Plan: pro Nutzer und Tag eine Zeile.
CREATE TABLE IF NOT EXISTS plan_schritte (
  nutzer_id INTEGER NOT NULL REFERENCES nutzer(id) ON DELETE CASCADE,
  nr INTEGER NOT NULL,
  etappe INTEGER NOT NULL,
  etappe_name TEXT NOT NULL,
  ziel TEXT NOT NULL,
  titel TEXT NOT NULL,
  min INTEGER NOT NULL,
  tun TEXT NOT NULL,          -- die einzelnen Schritte als JSON-Liste
  fertig TEXT NOT NULL,
  hinweis TEXT NOT NULL DEFAULT '',
  erledigt_am TEXT,           -- leer, solange der Tag offen ist
  PRIMARY KEY (nutzer_id, nr)
);

-- Welche Anpassungen am Plan gemacht wurden, zum Anzeigen.
CREATE TABLE IF NOT EXISTS plan_info (
  nutzer_id INTEGER PRIMARY KEY REFERENCES nutzer(id) ON DELETE CASCADE,
  angewendet TEXT NOT NULL,   -- JSON-Liste
  erstellt TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Wie der Mentor mit dem Nutzer reden soll. Eine Zeile pro Nutzer.
CREATE TABLE IF NOT EXISTS mentor (
  nutzer_id INTEGER PRIMARY KEY REFERENCES nutzer(id) ON DELETE CASCADE,
  ton INTEGER NOT NULL,
  eingerichtet_am TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Wer die Einführung schon gesehen hat. Sie erscheint nur beim ersten Anmelden.
CREATE TABLE IF NOT EXISTS einfuehrung (
  nutzer_id INTEGER PRIMARY KEY REFERENCES nutzer(id) ON DELETE CASCADE,
  gesehen_am TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Das Gespräch mit dem Mentor. Pro Nachricht eine Zeile.
CREATE TABLE IF NOT EXISTS mentor_nachrichten (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nutzer_id INTEGER NOT NULL REFERENCES nutzer(id) ON DELETE CASCADE,
  rolle TEXT NOT NULL,          -- "user" für den Nutzer, "assistant" für den Mentor
  text TEXT NOT NULL,
  erstellt TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS mentor_nachrichten_nutzer ON mentor_nachrichten (nutzer_id, id);

-- Die von der KI persönlich umgeschriebene Fassung eines Tages. Fehlt sie, gilt die Vorlage.
CREATE TABLE IF NOT EXISTS plan_persoenlich (
  nutzer_id INTEGER NOT NULL REFERENCES nutzer(id) ON DELETE CASCADE,
  nr INTEGER NOT NULL,
  inhalt TEXT NOT NULL,       -- JSON: titel, tun, fertig, hinweis
  erstellt TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (nutzer_id, nr)
);
