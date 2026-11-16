// Alles rund ums Konto: Passwort sicher speichern, anmelden, Sitzung prüfen.

const DURCHGAENGE = 100000; // So oft wird das Passwort verrechnet. Das bremst Angreifer aus.
const SITZUNG_TAGE = 30;

function zuHex(bytes) {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function vonHex(hex) {
  return new Uint8Array(hex.match(/.{2}/g).map((h) => parseInt(h, 16)));
}

function zufall(anzahlBytes) {
  return zuHex(crypto.getRandomValues(new Uint8Array(anzahlBytes)));
}

// Macht aus Passwort und Salz einen Hash. Aus dem Hash lässt sich das Passwort nicht zurückrechnen.
async function hashe(passwort, salzHex) {
  const schluessel = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passwort),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: vonHex(salzHex), iterations: DURCHGAENGE },
    schluessel,
    256
  );
  return zuHex(bits);
}

// Vergleicht zwei Texte so, dass man an der Dauer nichts über den Inhalt ablesen kann.
function gleich(a, b) {
  if (a.length !== b.length) return false;
  let unterschied = 0;
  for (let i = 0; i < a.length; i++) unterschied |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return unterschied === 0;
}

export function pruefeEingabe(email, passwort) {
  if (typeof email !== "string" || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 200) {
    return "Bitte gib eine gültige E-Mail-Adresse ein.";
  }
  if (typeof passwort !== "string" || passwort.length < 8 || passwort.length > 200) {
    return "Das Passwort braucht mindestens 8 Zeichen.";
  }
  return null;
}

export async function registriere(db, email, passwort) {
  const adresse = email.trim().toLowerCase();
  const vorhanden = await db.prepare("SELECT id FROM nutzer WHERE email = ?").bind(adresse).first();
  if (vorhanden) return { fehler: "Zu dieser E-Mail gibt es schon ein Konto." };
  const salz = zufall(16);
  const hash = await hashe(passwort, salz);
  const ergebnis = await db
    .prepare("INSERT INTO nutzer (email, pass_hash, salz) VALUES (?, ?, ?)")
    .bind(adresse, hash, salz)
    .run();
  return { nutzerId: ergebnis.meta.last_row_id };
}

export async function melde_an(db, email, passwort) {
  const adresse = String(email).trim().toLowerCase();
  const nutzer = await db
    .prepare("SELECT id, pass_hash, salz FROM nutzer WHERE email = ?")
    .bind(adresse)
    .first();
  // Auch ohne Treffer wird gerechnet, damit man nicht an der Dauer erkennt, ob es das Konto gibt.
  const hash = await hashe(String(passwort), nutzer ? nutzer.salz : "00".repeat(16));
  if (!nutzer || !gleich(hash, nutzer.pass_hash)) {
    return { fehler: "E-Mail oder Passwort stimmt nicht." };
  }
  return { nutzerId: nutzer.id };
}

// Legt eine Sitzung an und gibt das Kennzeichen zurück, das der Browser als Cookie bekommt.
export async function neueSitzung(db, nutzerId) {
  const kennzeichen = zufall(32);
  const ablauf = new Date(Date.now() + SITZUNG_TAGE * 86400000).toISOString();
  await db
    .prepare("INSERT INTO sitzungen (kennzeichen, nutzer_id, ablauf) VALUES (?, ?, ?)")
    .bind(kennzeichen, nutzerId, ablauf)
    .run();
  return kennzeichen;
}

export function cookieSetzen(kennzeichen, istHttps) {
  const teile = [
    `sitzung=${kennzeichen}`,
    "Path=/",
    "HttpOnly", // Skripte im Browser können das Cookie nicht lesen.
    "SameSite=Lax",
    `Max-Age=${SITZUNG_TAGE * 86400}`,
  ];
  if (istHttps) teile.push("Secure");
  return teile.join("; ");
}

export function cookieLoeschen() {
  return "sitzung=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0";
}

function leseKennzeichen(request) {
  const cookie = request.headers.get("Cookie") || "";
  const treffer = cookie.match(/(?:^|;\s*)sitzung=([a-f0-9]{64})/);
  return treffer ? treffer[1] : null;
}

// Gibt den angemeldeten Nutzer zurück oder null.
export async function werIstDa(db, request) {
  const kennzeichen = leseKennzeichen(request);
  if (!kennzeichen) return null;
  const zeile = await db
    .prepare(
      "SELECT n.id, n.email FROM sitzungen s JOIN nutzer n ON n.id = s.nutzer_id WHERE s.kennzeichen = ? AND s.ablauf > ?"
    )
    .bind(kennzeichen, new Date().toISOString())
    .first();
  return zeile || null;
}

export async function beendeSitzung(db, request) {
  const kennzeichen = leseKennzeichen(request);
  if (kennzeichen) {
    await db.prepare("DELETE FROM sitzungen WHERE kennzeichen = ?").bind(kennzeichen).run();
  }
}
