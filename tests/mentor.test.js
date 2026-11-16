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
