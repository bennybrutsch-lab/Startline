// Prüft den Auftrag an die KI und die Prüfung ihres Plans. Starten mit: npm test
// Die KI selbst wird hier nicht aufgerufen.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { alleFragen } from "../src/punkte.js";
import { bauePlanAuftrag, pruefePlan, schreibePlan, etappeFuerTag, TAGE } from "../src/plan-ki.js";

const lies = (datei) => JSON.parse(readFileSync(new URL(`../daten/${datei}`, import.meta.url), "utf8"));
const fragen = alleFragen(lies("fragen.json"));
const wege = lies("wege.json").wege;
const weg = wege.find((w) => w.id === "kanal");

// Standard: 18 bis 21, 20 bis 60 Minuten am Tag, überall sonst die zweite Antwort.
const A = {};
for (const f of fragen) A[f.nr] = 1;
A[1] = 2;
const V = { 1: 1, 2: 0, 3: 1 };

// Ein Plan, wie ihn die KI liefern soll.
function guterPlan(aenderung = (tage) => tage) {
  const tage = Array.from({ length: TAGE }, (_, i) => ({
    tag: i + 1,
    titel: `Aufgabe für Tag ${i + 1}`,
    minuten: 30,
    schritte: ["Mach das Erste.", "Mach das Zweite."],
    fertig_wenn: "beides erledigt ist",
    hinweis: "",
  }));
  return { tage: aenderung(tage), anpassungen: ["Du postest drei- bis viermal pro Woche. Der Plan rechnet damit."] };
}

test("jeder Tag gehört zur richtigen Etappe", () => {
  assert.deepEqual([1, 7, 8, 14, 15, 22, 23, 30].map(etappeFuerTag), [1, 1, 2, 2, 3, 3, 4, 4]);
});

test("der Auftrag enthält Steckbrief, Antworten und Angaben zum Weg", () => {
  const auftrag = bauePlanAuftrag(weg, fragen, A, V);
  assert.match(auftrag, /Eigener TikTok- oder YouTube-Kanal/);
  for (const e of weg.etappen) {
    assert.ok(auftrag.includes(e.ziel));
    for (const m of e.meilensteine) assert.ok(auftrag.includes(m));
  }
  for (const hinweis of weg.recht) assert.ok(auftrag.includes(hinweis));
  assert.match(auftrag, /Wie alt bist du\? 18 bis 21/);
  assert.match(auftrag, /Worum soll dein Kanal gehen\? Gaming/);
  assert.match(auftrag, /höchstens 45 Minuten/);
  assert.match(auftrag, /volljährig/);
});

test("der Auftrag sagt, wenn die Person unter 18 ist und wenig Zeit hat", () => {
  const auftrag = bauePlanAuftrag(weg, fragen, { ...A, 1: 0, 3: 0 }, V);
  assert.match(auftrag, /unter 18/);
  assert.match(auftrag, /höchstens 20 Minuten/);
});

test("für jeden der 25 neuen Wege lässt sich ein Auftrag bauen", () => {
  for (const w of wege.filter((x) => !x.plan)) {
    const auftrag = bauePlanAuftrag(w, fragen, A, { 1: 0, 2: 0, 3: 0 });
    assert.ok(auftrag.includes(w.name), w.id);
    assert.ok(auftrag.includes(w.vertiefung[0].antworten[0]), w.id);
  }
});

test("ein guter Plan wird angenommen und bekommt Etappen, Ziele und Nummern", () => {
  const plan = pruefePlan(guterPlan(), weg, A);
  assert.equal(plan.fehler, undefined);
  assert.equal(plan.tage, 30);
  plan.schritte.forEach((s, i) => assert.equal(s.nr, i + 1));
  assert.equal(plan.schritte[0].etappeName, weg.etappen[0].name);
  assert.equal(plan.schritte[7].ziel, weg.etappen[1].ziel);
  assert.equal(plan.schritte[29].etappe, 4);
  assert.deepEqual(Object.keys(plan.schritte[0]), ["nr", "etappe", "etappeName", "ziel", "titel", "min", "tun", "fertig", "hinweis"]);
  assert.equal(plan.angewendet.length, 1);
});

test("ein Plan mit falscher Zahl an Tagen wird abgelehnt", () => {
  assert.match(pruefePlan(guterPlan((t) => t.slice(0, 29)), weg, A).fehler, /29 statt 30/);
  assert.ok(pruefePlan({ tage: "nichts" }, weg, A).fehler);
  assert.ok(pruefePlan(null, weg, A).fehler);
});

test("fehlende oder unbrauchbare Angaben an einem Tag führen zur Ablehnung", () => {
  const mit = (stelle, aenderung) => guterPlan((t) => t.map((tag, i) => (i === stelle ? { ...tag, ...aenderung } : tag)));
  assert.match(pruefePlan(mit(4, { titel: " " }), weg, A).fehler, /Tag 5/);
  assert.match(pruefePlan(mit(9, { schritte: [] }), weg, A).fehler, /Tag 10/);
  assert.match(pruefePlan(mit(9, { schritte: ["a", "b", "c", "d", "e", "f"] }), weg, A).fehler, /Tag 10/);
  assert.match(pruefePlan(mit(11, { fertig_wenn: "" }), weg, A).fehler, /Tag 12/);
  assert.match(pruefePlan(mit(2, { minuten: 0 }), weg, A).fehler, /Tag 3/);
  assert.match(pruefePlan(mit(2, { tag: 7 }), weg, A).fehler, /Tag 3/);
  assert.match(pruefePlan(mit(2, { hinweis: "x".repeat(600) }), weg, A).fehler, /Tag 3/);
});

test("dreißigmal derselbe Titel wird abgelehnt", () => {
  const plan = guterPlan((t) => t.map((tag) => ({ ...tag, titel: "Video posten" })));
  assert.match(pruefePlan(plan, weg, A).fehler, /denselben Titel/);
});

test("keine Aufgabe dauert länger, als die Person am Tag Zeit hat", () => {
  const lang = guterPlan((t) => t.map((tag) => ({ ...tag, minuten: 90 })));
  assert.equal(Math.max(...pruefePlan(lang, weg, A).schritte.map((s) => s.min)), 45);
  assert.equal(Math.max(...pruefePlan(lang, weg, { ...A, 3: 0 }).schritte.map((s) => s.min)), 20);
  assert.equal(Math.max(...pruefePlan(lang, weg, { ...A, 3: 3 }).schritte.map((s) => s.min)), 90);
});

test('ein doppeltes "Fertig, wenn" wird entfernt', () => {
  const plan = guterPlan((t) => t.map((tag) => ({ ...tag, fertig_wenn: "Fertig, wenn drei Videos online sind" })));
  assert.equal(pruefePlan(plan, weg, A).schritte[0].fertig, "drei Videos online sind");
});

test("unter 18 steht das Gespräch mit den Eltern immer im Plan", () => {
  const ohne = pruefePlan(guterPlan(), weg, { ...A, 1: 1 });
  assert.match(ohne.schritte[0].hinweis, /^Pflicht für dich:.*Eltern/);

  const mitHinweis = guterPlan((t) => t.map((tag, i) => (i === 2 ? { ...tag, hinweis: "Pflicht für dich: Sprich mit deinen Eltern." } : tag)));
  const plan = pruefePlan(mitHinweis, weg, { ...A, 1: 0 });
  assert.equal(plan.schritte[0].hinweis, "");
  assert.match(plan.schritte[2].hinweis, /Eltern/);

  assert.equal(pruefePlan(guterPlan(), weg, A).schritte[0].hinweis, "");
});

test("ohne Schlüssel schreibt die KI keinen Plan", async () => {
  const ergebnis = await schreibePlan({}, weg, fragen, A, V);
  assert.equal(ergebnis.status, 409);
  assert.match(ergebnis.fehler, /noch keinen Plan/);
});
