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

-- Die Antworten auf die 25 Fragen. Pro Nutzer und Frage eine Zeile.
CREATE TABLE IF NOT EXISTS antworten (
  nutzer_id INTEGER NOT NULL REFERENCES nutzer(id) ON DELETE CASCADE,
  frage_nr INTEGER NOT NULL,
  antwort INTEGER NOT NULL,
  PRIMARY KEY (nutzer_id, frage_nr)
);
