// Prüft die Steckbriefe der 26 Wege. Starten mit: npm test
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const lies = (datei) => JSON.parse(readFileSync(new URL(`../daten/${datei}`, import.meta.url), "utf8"));
const { bereiche, wege } = lies("wege.json");
const eigenschaften = lies("fragen.json").eigenschaften.map((e) => e.id);
const text = (wert) => typeof wert === "string" && wert.trim().length > 0;

test("es gibt 26 Wege mit eindeutigen Kennungen in drei Bereichen", () => {
  assert.equal(wege.length, 26);
  assert.equal(new Set(wege.map((w) => w.id)).size, 26);
  assert.equal(new Set(wege.map((w) => w.name)).size, 26);
  const anzahl = (b) => wege.filter((w) => w.bereich === b).length;
  assert.deepEqual(bereiche.map((b) => b.id), ["creator", "fashion", "ki"]);
  assert.deepEqual([anzahl("creator"), anzahl("fashion"), anzahl("ki")], [10, 5, 11]);
});

test("jeder Weg hat Beschreibung, ehrlichen Satz, rechtliche Hinweise und die Angaben für die Karte", () => {
  for (const w of wege) {
    for (const feld of ["name", "kurz", "ehrlich", "schwierigkeit", "erstesGeld", "ersterSchritt"]) {
      assert.ok(text(w[feld]), `${w.id}: ${feld}`);
    }
    assert.ok(Array.isArray(w.recht) && w.recht.length >= 2 && w.recht.every(text), `${w.id}: recht`);
    assert.equal(typeof w.brauchtLaptop, "boolean", w.id);
    assert.equal(typeof w.verfuegbar, "boolean", w.id);
  }
});

test("jedes Profil nutzt nur bekannte Eigenschaften mit Gewichten von -3 bis 3", () => {
  for (const w of wege) {
    const eintraege = Object.entries(w.profil);
    assert.ok(eintraege.length >= 2, w.id);
    for (const [e, gewicht] of eintraege) {
      assert.ok(eigenschaften.includes(e), `${w.id}: ${e}`);
      assert.ok(Number.isInteger(gewicht) && gewicht !== 0 && gewicht >= -3 && gewicht <= 3, `${w.id}: ${e}`);
    }
  }
});

test("keine zwei Wege haben das gleiche Profil", () => {
  const profile = wege.map((w) => JSON.stringify(Object.entries(w.profil).sort()));
  assert.equal(new Set(profile).size, wege.length);
});

test("die 25 neuen Wege haben drei Vertiefungsfragen und vier Etappen mit je drei Meilensteinen", () => {
  const neue = wege.filter((w) => !w.plan);
  assert.equal(neue.length, 25);
  for (const w of neue) {
    assert.equal(w.verfuegbar, false, `${w.id}: wählbar erst, wenn der Schlüssel für die KI hinterlegt ist`);
    assert.equal(w.vertiefung.length, 3, w.id);
    for (const f of w.vertiefung) {
      assert.ok(text(f.frage) && text(f.wozu), w.id);
      assert.ok(f.antworten.length >= 2 && f.antworten.every(text), w.id);
    }
    assert.equal(w.etappen.length, 4, w.id);
    w.etappen.forEach((e, i) => {
      assert.equal(e.nr, i + 1, w.id);
      assert.ok(text(e.name) && text(e.tage) && text(e.ziel), `${w.id}: Etappe ${e.nr}`);
      assert.ok(e.ziel.startsWith("Am Ende "), `${w.id}: Ziel von Etappe ${e.nr}`);
      assert.equal(e.meilensteine.length, 3, `${w.id}: Etappe ${e.nr}`);
      assert.ok(e.meilensteine.every(text), `${w.id}: Etappe ${e.nr}`);
    });
  }
});

test("der Website-Weg zeigt auf seinen handgeschriebenen Plan und heißt dort gleich", () => {
  const mitPlan = wege.filter((w) => w.plan);
  assert.equal(mitPlan.length, 1);
  const plan = lies(mitPlan[0].plan);
  assert.equal(plan.id, mitPlan[0].id);
  assert.equal(plan.name, mitPlan[0].name);
  assert.equal(mitPlan[0].verfuegbar, true);
  assert.equal(plan.etappen.flatMap((e) => e.schritte).length, 30);
});
