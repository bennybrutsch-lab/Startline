// Prüft, dass aus dem Gerüst der richtige persönliche Plan entsteht. Starten mit: npm test
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { erstellePlan } from "../src/plan.js";

const weg = JSON.parse(readFileSync(new URL("../daten/weg-websites.json", import.meta.url), "utf8"));

// Standard: 18 bis 21, 20 bis 60 Minuten, spricht gern Fremde an, kommt zu Fuß, kennt niemanden, keine Website.
const A = { 1: 2, 3: 1, 8: 0 };
const V = { 1: 0, 2: 0, 3: 2, 4: 2, 5: 0, 6: 1 };
const text = (plan) => JSON.stringify(plan.schritte);

test("ohne Besonderheiten bleibt es bei 30 Tagen, fortlaufend nummeriert", () => {
  const plan = erstellePlan(weg, A, V);
  assert.equal(plan.tage, 30);
  plan.schritte.forEach((s, i) => assert.equal(s.nr, i + 1));
  assert.deepEqual(plan.angewendet, []);
});

test("jeder Schritt hat Titel, Aufgaben und ein Fertig-Kriterium", () => {
  for (const s of erstellePlan(weg, A, V).schritte) {
    assert.ok(s.titel && s.fertig && s.tun.length > 0 && s.min > 0, `Tag ${s.nr}`);
  }
});

test("die gewählte Branche steht im Plan", () => {
  assert.ok(text(erstellePlan(weg, A, { ...V, 1: 1 })).includes("Cafés, Restaurants, Imbisse"));
});

test("wenig Zeit verteilt die Schritte auf mehr Tage mit kürzeren Einheiten", () => {
  const normal = erstellePlan(weg, A, V);
  const kurz = erstellePlan(weg, { ...A, 3: 0 }, V);
  assert.ok(kurz.tage > normal.tage);
  assert.ok(Math.max(...kurz.schritte.map((s) => s.min)) <= 30);
});

test("viel Zeit verkürzt die erste Etappe auf vier Tage", () => {
  const plan = erstellePlan(weg, { ...A, 3: 3 }, V);
  assert.equal(plan.schritte.filter((s) => s.etappe === 1).length, 4);
});

test("wer schon eine Website hat, baut kein neues Beispiel", () => {
  const plan = erstellePlan(weg, A, { ...V, 4: 1 });
  assert.equal(plan.tage, 29);
  assert.ok(!text(plan).includes("Erfinde einen Betrieb"));
  assert.ok(text(plan).includes("Website an die Branche anpassen"));
});

test("wer nicht zu den Betrieben kommt, schreibt statt hinzugehen und hat 40 auf der Liste", () => {
  const plan = erstellePlan(weg, A, { ...V, 2: 3 });
  assert.ok(!text(plan).includes("Geh in drei Betriebe"));
  assert.ok(text(plan).includes("Schreib 40 auf"));
});

test("wer ungern Fremde anspricht, startet schriftlich", () => {
  const plan = erstellePlan(weg, { ...A, 8: 3 }, V);
  assert.ok(!text(plan).includes("Geh in drei Betriebe"));
  assert.ok(plan.angewendet.some((a) => a.includes("Nachrichten")));
});

test("unter 18 sind die Eltern-Schritte als Pflicht markiert", () => {
  const plan = erstellePlan(weg, { ...A, 1: 1 }, V);
  assert.equal(plan.schritte.filter((s) => s.hinweis.startsWith("Pflicht für dich")).length, 2);
});

test("wer einen Inhaber kennt, bekommt den Hinweis, dort anzufangen", () => {
  const plan = erstellePlan(weg, A, { ...V, 3: 0 });
  assert.ok(plan.schritte.some((s) => s.hinweis.includes("Inhaber du kennst")));
});
