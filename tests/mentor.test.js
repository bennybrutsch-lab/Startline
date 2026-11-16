// Prüft, was der Mentor über den Nutzer erfährt. Ohne KI-Aufruf. Starten mit: npm test
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { baueKontext, baueVerlauf, frageMentor } from "../src/mentor.js";
import { alleFragen } from "../src/punkte.js";
import { erstellePlan } from "../src/plan.js";

const daten = JSON.parse(readFileSync(new URL("../daten/fragen.json", import.meta.url), "utf8"));
const weg = JSON.parse(readFileSync(new URL("../daten/weg-websites.json", import.meta.url), "utf8"));
const fragen = alleFragen(daten);
const antworten = {};
for (const f of fragen) antworten[f.nr] = 0;
const vertiefung = { 1: 1, 2: 0, 3: 0, 4: 2, 5: 0, 6: 1 };
const plan = erstellePlan(weg, antworten, vertiefung).schritte.map((s) => ({ ...s, erledigt: s.nr <= 2 }));

test("ohne Antworten sagt der Kontext, dass der Mentor die Person noch nicht kennt", () => {
  const k = baueKontext({ ton: 0, fragen, antworten: {}, weg: null, vertiefung: {}, schritte: [] });
  assert.match(k, /noch nicht beantwortet/);
  assert.match(k, /noch keinen Weg/);
});

test("mit Plan kennt der Mentor Antworten, Weg und die aktuelle Aufgabe", () => {
  const k = baueKontext({ ton: 1, fragen, antworten, weg, vertiefung, schritte: plan });
  assert.match(k, /24 von 24/);
  assert.match(k, /Websites für Betriebe vor Ort/);
  assert.match(k, /Cafés, Restaurants, Imbisse/);
  assert.match(k, /davon 2 geschafft/);
  assert.match(k, /Aktuelle Aufgabe, Tag 3/);
  assert.match(k, /coach/i);
});

test("der Verlauf beginnt immer mit einer Nachricht des Nutzers", () => {
  const v = baueVerlauf([
    { rolle: "assistant", text: "a" },
    { rolle: "user", text: "b" },
    { rolle: "assistant", text: "c" },
    { rolle: "user", text: "d" },
  ]);
  assert.equal(v[0].role, "user");
  assert.deepEqual(v.map((n) => n.content), ["b", "c", "d"]);
});

test("ohne Schlüssel meldet der Mentor, dass er nicht verbunden ist, statt abzustürzen", async () => {
  const e = await frageMentor({}, "kontext", [{ role: "user", content: "hallo" }]);
  assert.equal(e.nichtVerbunden, true);
  assert.match(e.text, /nicht verbunden/);
});

import { pruefeAngepasst, passeAufgabeAn } from "../src/mentor.js";

const vorlage = { nr: 8, titel: "Dein Angebot", min: 30, tun: ["a"], fertig: "x", hinweis: "Pflicht für dich: Eltern fragen." };

test("eine gute angepasste Aufgabe wird übernommen, doppeltes \"Fertig, wenn\" entfernt", () => {
  const a = pruefeAngepasst({ titel: "Dein Angebot für Salon Mia", tun: ["Schritt 1", "Schritt 2"], fertig: "Fertig, wenn dein Angebot steht.", hinweis: "Pflicht für dich: Eltern fragen." }, vorlage);
  assert.equal(a.titel, "Dein Angebot für Salon Mia");
  assert.equal(a.fertig, "dein Angebot steht.");
});

test("fehlt der Hinweis in der Antwort, bleibt der aus der Vorlage erhalten", () => {
  const a = pruefeAngepasst({ titel: "T", tun: ["s"], fertig: "f", hinweis: "" }, vorlage);
  assert.equal(a.hinweis, "Pflicht für dich: Eltern fragen.");
});

test("unbrauchbare Antworten werden verworfen", () => {
  assert.equal(pruefeAngepasst({ titel: "", tun: ["s"], fertig: "f", hinweis: "" }, vorlage), null);
  assert.equal(pruefeAngepasst({ titel: "T", tun: [], fertig: "f", hinweis: "" }, vorlage), null);
  assert.equal(pruefeAngepasst({ titel: "T", tun: ["1", "2", "3", "4", "5", "6"], fertig: "f", hinweis: "" }, vorlage), null);
  assert.equal(pruefeAngepasst(null, vorlage), null);
});

test("ohne Schlüssel wird nichts angepasst und die Vorlage gilt", async () => {
  assert.equal(await passeAufgabeAn({}, "k", vorlage, []), null);
});
