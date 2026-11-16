// Der Server der Startline-App. Jede Anfrage aus dem Browser kommt hier an.
// Adressen, die mit /api/ beginnen, beantwortet dieser Code. Alles andere sind Dateien aus "public".

import fragenDaten from "../daten/fragen.json";
import { alleFragen, berechne } from "./punkte.js";
import {
  pruefeEingabe,
  registriere,
  melde_an,
  neueSitzung,
  cookieSetzen,
  cookieLoeschen,
  werIstDa,
  beendeSitzung,
} from "./konto.js";

function antwort(daten, status = 200, kopf = {}) {
  return new Response(JSON.stringify(daten), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...kopf },
  });
}

async function leseJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

// Die Fragen für den Browser, ohne die Punkte. Sonst könnte man das Ergebnis vorher ablesen.
function fragenOhnePunkte() {
  return fragenDaten.bloecke.map((block) => ({
    titel: block.titel,
    fragen: block.fragen.map((f) => ({
      nr: f.nr,
      text: f.text,
      antworten: f.antworten.map((a) => a.text),
    })),
  }));
}

async function ladeAntworten(db, nutzerId) {
  const { results } = await db
    .prepare("SELECT frage_nr, antwort FROM antworten WHERE nutzer_id = ?")
    .bind(nutzerId)
    .all();
  const antworten = {};
  for (const zeile of results) antworten[zeile.frage_nr] = zeile.antwort;
  return antworten;
}

async function api(request, env, url) {
  const db = env.DB;
  const weg = url.pathname;
  const art = request.method;
  const istHttps = url.protocol === "https:";

  // Schutz: Änderungen nur von der eigenen Seite aus annehmen.
  if (art !== "GET") {
    const herkunft = request.headers.get("Origin");
    if (herkunft && herkunft !== url.origin) return antwort({ fehler: "Nicht erlaubt." }, 403);
  }

  if (weg === "/api/registrieren" && art === "POST") {
    const eingabe = await leseJson(request);
    if (!eingabe) return antwort({ fehler: "Die Anfrage war nicht lesbar." }, 400);
    const fehler = pruefeEingabe(eingabe.email, eingabe.passwort);
    if (fehler) return antwort({ fehler }, 400);
    const ergebnis = await registriere(db, eingabe.email, eingabe.passwort);
    if (ergebnis.fehler) return antwort({ fehler: ergebnis.fehler }, 409);
    const kennzeichen = await neueSitzung(db, ergebnis.nutzerId);
    return antwort({ ok: true }, 201, { "Set-Cookie": cookieSetzen(kennzeichen, istHttps) });
  }

  if (weg === "/api/anmelden" && art === "POST") {
    const eingabe = await leseJson(request);
    if (!eingabe) return antwort({ fehler: "Die Anfrage war nicht lesbar." }, 400);
    const ergebnis = await melde_an(db, eingabe.email, eingabe.passwort);
    if (ergebnis.fehler) return antwort({ fehler: ergebnis.fehler }, 401);
    const kennzeichen = await neueSitzung(db, ergebnis.nutzerId);
    return antwort({ ok: true }, 200, { "Set-Cookie": cookieSetzen(kennzeichen, istHttps) });
  }

  if (weg === "/api/abmelden" && art === "POST") {
    await beendeSitzung(db, request);
    return antwort({ ok: true }, 200, { "Set-Cookie": cookieLoeschen() });
  }

  // Ab hier muss man angemeldet sein.
  const nutzer = await werIstDa(db, request);
  if (!nutzer) return antwort({ fehler: "Bitte melde dich an." }, 401);

  if (weg === "/api/ich" && art === "GET") {
    return antwort({ email: nutzer.email });
  }

  if (weg === "/api/fragen" && art === "GET") {
    return antwort({ bloecke: fragenOhnePunkte(), antworten: await ladeAntworten(db, nutzer.id) });
  }

  if (weg === "/api/antworten" && art === "POST") {
    const eingabe = await leseJson(request);
    const frage = alleFragen(fragenDaten).find((f) => f.nr === eingabe?.frage);
    if (!frage) return antwort({ fehler: "Diese Frage gibt es nicht." }, 400);
    if (!Number.isInteger(eingabe.antwort) || !frage.antworten[eingabe.antwort]) {
      return antwort({ fehler: "Diese Antwort gibt es nicht." }, 400);
    }
    await db
      .prepare(
        "INSERT INTO antworten (nutzer_id, frage_nr, antwort) VALUES (?, ?, ?) ON CONFLICT (nutzer_id, frage_nr) DO UPDATE SET antwort = excluded.antwort"
      )
      .bind(nutzer.id, frage.nr, eingabe.antwort)
      .run();
    return antwort({ ok: true });
  }

  if (weg === "/api/ergebnis" && art === "GET") {
    const antworten = await ladeAntworten(db, nutzer.id);
    const anzahl = alleFragen(fragenDaten).length;
    if (Object.keys(antworten).length < anzahl) {
      return antwort({ fehler: "Es sind noch nicht alle Fragen beantwortet.", beantwortet: Object.keys(antworten).length, anzahl }, 409);
    }
    const ergebnis = berechne(fragenDaten, antworten);
    // Die genauen Punkte bleiben auf dem Server. Der Browser bekommt nur die Vorschläge.
    return antwort({
      vorschlaege: ergebnis.vorschlaege.map(({ punkte, ...rest }) => rest),
      knapp: ergebnis.knapp,
      gesperrt: ergebnis.gesperrt,
    });
  }

  return antwort({ fehler: "Diese Adresse gibt es nicht." }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      try {
        return await api(request, env, url);
      } catch (fehler) {
        console.error("Fehler in der API:", fehler);
        return antwort({ fehler: "Da ist etwas schiefgegangen. Versuch es noch einmal." }, 500);
      }
    }
    return env.ASSETS.fetch(request);
  },
};
