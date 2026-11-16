// Der Server der Startline-App. Jede Anfrage aus dem Browser kommt hier an.
// Adressen, die mit /api/ beginnen, beantwortet dieser Code. Alles andere sind Dateien aus "public".

import fragenDaten from "../daten/fragen.json";
import wegWebsites from "../daten/weg-websites.json";
import mentorDaten from "../daten/mentor.json";
import einfuehrungDaten from "../daten/einfuehrung.json";
import { alleFragen, berechne } from "./punkte.js";
import { erstellePlan } from "./plan.js";
import { baueKontext, baueVerlauf, frageMentor, MAX_ZEICHEN, MAX_PRO_TAG } from "./mentor.js";
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

// Alle Wege, für die es schon einen Plan gibt.
const WEGE = { [wegWebsites.id]: wegWebsites };

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
    warum: block.warum,
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

// Das Datum in deutscher Zeit, zum Beispiel "2026-11-16". Damit zählt ein Tag von Mitternacht bis Mitternacht.
function tagInBerlin(datum) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(datum);
}

async function ladeVertiefung(db, nutzerId) {
  const { results } = await db
    .prepare("SELECT frage_nr, antwort FROM vertiefung WHERE nutzer_id = ?")
    .bind(nutzerId)
    .all();
  const antworten = {};
  for (const zeile of results) antworten[zeile.frage_nr] = zeile.antwort;
  return antworten;
}

async function ladeWeg(db, nutzerId) {
  const zeile = await db.prepare("SELECT richtung FROM wege WHERE nutzer_id = ?").bind(nutzerId).first();
  return zeile ? WEGE[zeile.richtung] || null : null;
}

async function ladePlan(db, nutzerId) {
  const { results } = await db
    .prepare("SELECT nr, etappe, etappe_name, ziel, titel, min, tun, fertig, hinweis, erledigt_am FROM plan_schritte WHERE nutzer_id = ? ORDER BY nr")
    .bind(nutzerId)
    .all();
  return results.map((z) => ({
    nr: z.nr,
    etappe: z.etappe,
    etappeName: z.etappe_name,
    ziel: z.ziel,
    titel: z.titel,
    min: z.min,
    tun: JSON.parse(z.tun),
    fertig: z.fertig,
    hinweis: z.hinweis,
    erledigt: Boolean(z.erledigt_am),
  }));
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

  // Wo steht der Nutzer gerade? Danach entscheidet der Browser, welche Ansicht er zeigt.
  if (weg === "/api/stand" && art === "GET") {
    const antworten = await ladeAntworten(db, nutzer.id);
    const anzahl = alleFragen(fragenDaten).length;
    const beantwortet = Object.keys(antworten).length;
    const gewaehlt = await ladeWeg(db, nutzer.id);
    const plan = await db
      .prepare("SELECT COUNT(*) AS gesamt, COUNT(erledigt_am) AS geschafft FROM plan_schritte WHERE nutzer_id = ?")
      .bind(nutzer.id)
      .first();
    const mentor = await db.prepare("SELECT ton FROM mentor WHERE nutzer_id = ?").bind(nutzer.id).first();
    // Der nächste Schritt im Bereich Plan.
    let stand = "neu";
    if (beantwortet > 0) stand = "fragen";
    if (beantwortet >= anzahl) stand = "ergebnis";
    if (beantwortet >= anzahl && gewaehlt) stand = plan.gesamt > 0 ? "plan" : "vertiefung";
    return antwort({
      stand,
      fragen: { beantwortet, anzahl },
      weg: gewaehlt ? gewaehlt.name : null,
      plan: plan.gesamt > 0 ? { gesamt: plan.gesamt, geschafft: plan.geschafft } : null,
      mentor: mentor ? mentorDaten.toene[mentor.ton]?.name || null : null,
      einfuehrungGesehen: Boolean(await db.prepare("SELECT 1 FROM einfuehrung WHERE nutzer_id = ?").bind(nutzer.id).first()),
    });
  }

  // Die Einführung: Seiten zum Durchtippen beim ersten Anmelden.
  if (weg === "/api/einfuehrung" && art === "GET") {
    return antwort({ seiten: einfuehrungDaten });
  }

  if (weg === "/api/einfuehrung/gesehen" && art === "POST") {
    await db.prepare("INSERT INTO einfuehrung (nutzer_id) VALUES (?) ON CONFLICT (nutzer_id) DO NOTHING").bind(nutzer.id).run();
    return antwort({ ok: true });
  }

  // Der Mentor: Auswahl ansehen und Ton festlegen.
  if (weg === "/api/mentor" && art === "GET") {
    const mentor = await db.prepare("SELECT ton FROM mentor WHERE nutzer_id = ?").bind(nutzer.id).first();
    return antwort({ ...mentorDaten, ton: mentor ? mentor.ton : null });
  }

  // Das Gespräch mit dem Mentor: bisherige Nachrichten laden.
  if (weg === "/api/mentor/gespraech" && art === "GET") {
    const { results } = await db
      .prepare("SELECT rolle, text FROM (SELECT id, rolle, text FROM mentor_nachrichten WHERE nutzer_id = ? ORDER BY id DESC LIMIT 100) ORDER BY id")
      .bind(nutzer.id)
      .all();
    return antwort({ nachrichten: results, maxZeichen: MAX_ZEICHEN, verbunden: Boolean(env.ANTHROPIC_API_KEY) });
  }

  // Eine Nachricht an den Mentor schicken und die Antwort bekommen.
  if (weg === "/api/mentor/nachricht" && art === "POST") {
    const eingabe = await leseJson(request);
    const text = typeof eingabe?.text === "string" ? eingabe.text.trim() : "";
    if (!text) return antwort({ fehler: "Schreib zuerst eine Nachricht." }, 400);
    if (text.length > MAX_ZEICHEN) return antwort({ fehler: `Die Nachricht ist zu lang. Höchstens ${MAX_ZEICHEN} Zeichen.` }, 400);
    const mentor = await db.prepare("SELECT ton FROM mentor WHERE nutzer_id = ?").bind(nutzer.id).first();
    if (!mentor) return antwort({ fehler: "Richte zuerst deinen Mentor ein." }, 409);

    // Kostenbremse: nur eine bestimmte Zahl Nachrichten pro Tag.
    const heute = tagInBerlin(new Date());
    const { results: eigene } = await db
      .prepare("SELECT erstellt FROM mentor_nachrichten WHERE nutzer_id = ? AND rolle = 'user' ORDER BY id DESC LIMIT ?")
      .bind(nutzer.id, MAX_PRO_TAG)
      .all();
    const heuteGeschrieben = eigene.filter((z) => tagInBerlin(new Date(z.erstellt.replace(" ", "T") + "Z")) === heute).length;
    if (heuteGeschrieben >= MAX_PRO_TAG) {
      return antwort({ fehler: `Du hast heute schon ${MAX_PRO_TAG} Nachrichten geschrieben. Morgen geht es weiter.` }, 429);
    }

    await db.prepare("INSERT INTO mentor_nachrichten (nutzer_id, rolle, text) VALUES (?, 'user', ?)").bind(nutzer.id, text).run();
    const { results: bisher } = await db
      .prepare("SELECT rolle, text FROM (SELECT id, rolle, text FROM mentor_nachrichten WHERE nutzer_id = ? ORDER BY id DESC LIMIT 40) ORDER BY id")
      .bind(nutzer.id)
      .all();
    const gewaehlt = await ladeWeg(db, nutzer.id);
    const kontext = baueKontext({
      ton: mentor.ton,
      fragen: alleFragen(fragenDaten),
      antworten: await ladeAntworten(db, nutzer.id),
      weg: gewaehlt,
      vertiefung: await ladeVertiefung(db, nutzer.id),
      schritte: await ladePlan(db, nutzer.id),
    });
    const ergebnis = await frageMentor(env, kontext, baueVerlauf(bisher));
    if (ergebnis.fehler) return antwort({ fehler: ergebnis.fehler }, 502);
    // Der Hinweis "nicht verbunden" wird nicht gespeichert, damit er später nicht als Antwort des Mentors gilt.
    if (!ergebnis.nichtVerbunden) {
      await db.prepare("INSERT INTO mentor_nachrichten (nutzer_id, rolle, text) VALUES (?, 'assistant', ?)").bind(nutzer.id, ergebnis.text).run();
    }
    return antwort({ text: ergebnis.text, nichtVerbunden: Boolean(ergebnis.nichtVerbunden) });
  }

  if (weg === "/api/mentor" && art === "POST") {
    const eingabe = await leseJson(request);
    if (!Number.isInteger(eingabe?.ton) || !mentorDaten.toene[eingabe.ton]) {
      return antwort({ fehler: "Bitte wähle einen Stil aus." }, 400);
    }
    await db
      .prepare("INSERT INTO mentor (nutzer_id, ton) VALUES (?, ?) ON CONFLICT (nutzer_id) DO UPDATE SET ton = excluded.ton")
      .bind(nutzer.id, eingabe.ton)
      .run();
    return antwort({ ok: true });
  }

  // Einen der drei vorgeschlagenen Wege wählen.
  if (weg === "/api/weg" && art === "POST") {
    const eingabe = await leseJson(request);
    const antworten = await ladeAntworten(db, nutzer.id);
    if (Object.keys(antworten).length < alleFragen(fragenDaten).length) {
      return antwort({ fehler: "Beantworte zuerst alle Fragen." }, 409);
    }
    const erlaubt = berechne(fragenDaten, antworten).vorschlaege.map((v) => v.id);
    if (!erlaubt.includes(eingabe?.richtung)) return antwort({ fehler: "Dieser Weg wurde dir nicht vorgeschlagen." }, 400);
    if (!WEGE[eingabe.richtung]) return antwort({ fehler: "Für diesen Weg gibt es noch keinen Plan." }, 409);
    // Ein neuer Weg heißt: alte Vertiefung und alter Plan gelten nicht mehr.
    await db.batch([
      db.prepare("DELETE FROM vertiefung WHERE nutzer_id = ?").bind(nutzer.id),
      db.prepare("DELETE FROM plan_schritte WHERE nutzer_id = ?").bind(nutzer.id),
      db.prepare("DELETE FROM plan_info WHERE nutzer_id = ?").bind(nutzer.id),
      db.prepare("INSERT INTO wege (nutzer_id, richtung) VALUES (?, ?) ON CONFLICT (nutzer_id) DO UPDATE SET richtung = excluded.richtung, gewaehlt_am = datetime('now')").bind(nutzer.id, eingabe.richtung),
    ]);
    return antwort({ ok: true });
  }

  // Den gewählten Weg wieder abwählen, zurück zu den drei Vorschlägen.
  if (weg === "/api/weg/abwaehlen" && art === "POST") {
    await db.batch([
      db.prepare("DELETE FROM vertiefung WHERE nutzer_id = ?").bind(nutzer.id),
      db.prepare("DELETE FROM plan_schritte WHERE nutzer_id = ?").bind(nutzer.id),
      db.prepare("DELETE FROM plan_info WHERE nutzer_id = ?").bind(nutzer.id),
      db.prepare("DELETE FROM wege WHERE nutzer_id = ?").bind(nutzer.id),
    ]);
    return antwort({ ok: true });
  }

  if (weg === "/api/vertiefung" && art === "GET") {
    const gewaehlt = await ladeWeg(db, nutzer.id);
    if (!gewaehlt) return antwort({ fehler: "Wähle zuerst einen Weg." }, 409);
    return antwort({
      weg: { id: gewaehlt.id, name: gewaehlt.name, ehrlich: gewaehlt.ehrlich },
      fragen: gewaehlt.vertiefung.map((f, i) => ({ nr: i + 1, text: f.frage, antworten: f.antworten })),
      antworten: await ladeVertiefung(db, nutzer.id),
    });
  }

  // Alle Vertiefungsfragen auf einmal speichern und daraus den Plan bauen.
  if (weg === "/api/plan/erstellen" && art === "POST") {
    const gewaehlt = await ladeWeg(db, nutzer.id);
    if (!gewaehlt) return antwort({ fehler: "Wähle zuerst einen Weg." }, 409);
    const eingabe = await leseJson(request);
    const vertiefung = {};
    for (let i = 0; i < gewaehlt.vertiefung.length; i++) {
      const wert = eingabe?.antworten?.[i + 1];
      if (!Number.isInteger(wert) || !gewaehlt.vertiefung[i].antworten[wert]) {
        return antwort({ fehler: `Bitte beantworte Frage ${i + 1}.` }, 400);
      }
      vertiefung[i + 1] = wert;
    }
    const antworten = await ladeAntworten(db, nutzer.id);
    const plan = erstellePlan(gewaehlt, antworten, vertiefung);
    const befehle = [
      db.prepare("DELETE FROM vertiefung WHERE nutzer_id = ?").bind(nutzer.id),
      db.prepare("DELETE FROM plan_schritte WHERE nutzer_id = ?").bind(nutzer.id),
      db.prepare("DELETE FROM plan_info WHERE nutzer_id = ?").bind(nutzer.id),
    ];
    for (const [nr, wert] of Object.entries(vertiefung)) {
      befehle.push(db.prepare("INSERT INTO vertiefung (nutzer_id, frage_nr, antwort) VALUES (?, ?, ?)").bind(nutzer.id, Number(nr), wert));
    }
    for (const s of plan.schritte) {
      befehle.push(
        db
          .prepare("INSERT INTO plan_schritte (nutzer_id, nr, etappe, etappe_name, ziel, titel, min, tun, fertig, hinweis) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
          .bind(nutzer.id, s.nr, s.etappe, s.etappeName, s.ziel, s.titel, s.min, JSON.stringify(s.tun), s.fertig, s.hinweis)
      );
    }
    befehle.push(db.prepare("INSERT INTO plan_info (nutzer_id, angewendet) VALUES (?, ?)").bind(nutzer.id, JSON.stringify(plan.angewendet)));
    await db.batch(befehle);
    return antwort({ ok: true, tage: plan.tage }, 201);
  }

  // Die Aufgabe von heute: der erste Tag im Plan, der noch offen ist.
  if (weg === "/api/heute" && art === "GET") {
    const schritte = await ladePlan(db, nutzer.id);
    if (!schritte.length) return antwort({ fehler: "Du hast noch keinen Plan." }, 404);
    const offen = schritte.find((s) => !s.erledigt) || null;
    const letzter = await db
      .prepare("SELECT nr, titel, erledigt_am FROM plan_schritte WHERE nutzer_id = ? AND erledigt_am IS NOT NULL ORDER BY nr DESC LIMIT 1")
      .bind(nutzer.id)
      .first();
    return antwort({
      schritt: offen,
      geschafft: schritte.filter((s) => s.erledigt).length,
      gesamt: schritte.length,
      // Wurde heute schon ein Tag abgehakt? Dann gilt der Tag als geschafft.
      heuteErledigt: Boolean(letzter) && tagInBerlin(new Date(letzter.erledigt_am)) === tagInBerlin(new Date()),
      letzter: letzter ? { nr: letzter.nr, titel: letzter.titel } : null,
    });
  }

  // Einen Tag abhaken. Es geht immer nur der nächste offene Tag, keiner wird übersprungen.
  if (weg === "/api/schritt/erledigt" && art === "POST") {
    const eingabe = await leseJson(request);
    const offen = await db
      .prepare("SELECT MIN(nr) AS nr FROM plan_schritte WHERE nutzer_id = ? AND erledigt_am IS NULL")
      .bind(nutzer.id)
      .first();
    if (!offen || offen.nr === null) return antwort({ fehler: "Es ist kein Tag mehr offen." }, 409);
    if (eingabe?.nr !== offen.nr) return antwort({ fehler: "Das ist nicht der nächste offene Tag." }, 409);
    await db
      .prepare("UPDATE plan_schritte SET erledigt_am = ? WHERE nutzer_id = ? AND nr = ?")
      .bind(new Date().toISOString(), nutzer.id, offen.nr)
      .run();
    return antwort({ ok: true });
  }

  // Den zuletzt abgehakten Tag wieder öffnen, falls man sich vertippt hat.
  if (weg === "/api/schritt/zurueck" && art === "POST") {
    const letzter = await db
      .prepare("SELECT MAX(nr) AS nr FROM plan_schritte WHERE nutzer_id = ? AND erledigt_am IS NOT NULL")
      .bind(nutzer.id)
      .first();
    if (!letzter || letzter.nr === null) return antwort({ fehler: "Es ist noch kein Tag abgehakt." }, 409);
    await db
      .prepare("UPDATE plan_schritte SET erledigt_am = NULL WHERE nutzer_id = ? AND nr = ?")
      .bind(nutzer.id, letzter.nr)
      .run();
    return antwort({ ok: true });
  }

  if (weg === "/api/plan" && art === "GET") {
    const gewaehlt = await ladeWeg(db, nutzer.id);
    const schritte = await ladePlan(db, nutzer.id);
    if (!gewaehlt || !schritte.length) return antwort({ fehler: "Du hast noch keinen Plan." }, 404);
    const info = await db.prepare("SELECT angewendet FROM plan_info WHERE nutzer_id = ?").bind(nutzer.id).first();
    return antwort({
      weg: { id: gewaehlt.id, name: gewaehlt.name, ehrlich: gewaehlt.ehrlich },
      angewendet: info ? JSON.parse(info.angewendet) : [],
      schritte,
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
