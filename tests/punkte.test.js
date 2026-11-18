// Prüft die Auswertung der Fragen. Starten mit: npm test
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { alleFragen, berechne, profilAus } from "../src/punkte.js";

const lies = (datei) => JSON.parse(readFileSync(new URL(`../daten/${datei}`, import.meta.url), "utf8"));
const daten = lies("fragen.json");
const wegeDaten = lies("wege.json");
const fragen = alleFragen(daten);
const wege = wegeDaten.wege;
const bereich = (id) => wege.find((w) => w.id === id).bereich;

// Hilfe: überall die zweite Antwort, außer dort, wo etwas anderes angegeben ist.
function antworten(abweichungen = {}) {
  const alle = {};
  for (const f of fragen) alle[f.nr] = 1;
  return { ...alle, ...abweichungen };
}

// Zufällige, aber immer gleiche Antworten. So prüft der Test viele Fälle und bleibt wiederholbar.
function zufallsAntworten(anzahl) {
  let stand = 7;
  const zufall = () => (stand = (stand * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  return Array.from({ length: anzahl }, () => {
    const alle = {};
    for (const f of fragen) alle[f.nr] = Math.floor(zufall() * f.antworten.length);
    return alle;
  });
}

test("es gibt 26 Fragen mit den Nummern 1 bis 26 und je mindestens zwei Antworten", () => {
  assert.equal(fragen.length, 26);
  assert.deepEqual(fragen.map((f) => f.nr).sort((a, b) => a - b), Array.from({ length: 26 }, (_, i) => i + 1));
  for (const f of fragen) assert.ok(f.antworten.length >= 2, `Frage ${f.nr}`);
});

test("die zwei neuen Fragen sind da", () => {
  const texte = fragen.map((f) => f.text);
  assert.ok(texte.includes("Welcher Bereich reizt dich am meisten?"));
  assert.ok(texte.includes("Was machst du am Handy oder Laptop am meisten?"));
});

test("es gibt die zwölf Eigenschaften, und Antworten nutzen nur diese", () => {
  const bekannt = daten.eigenschaften.map((e) => e.id);
  assert.deepEqual(bekannt, ["kamera", "schnitt", "design", "technik", "verkaufen", "kunden", "bauen", "tempo", "geduld", "community", "schreiben", "startgeld"]);
  for (const f of fragen) {
    for (const a of f.antworten) {
      for (const e of Object.keys(a.eigenschaften)) assert.ok(bekannt.includes(e), `${e} in Frage ${f.nr}`);
      if (a.bereich) assert.ok(wegeDaten.bereiche.some((b) => b.id === a.bereich), `${a.bereich} in Frage ${f.nr}`);
    }
  }
});

test("jede Eigenschaft kann man in mindestens einer Frage sammeln", () => {
  for (const e of daten.eigenschaften) {
    assert.ok(fragen.some((f) => f.antworten.some((a) => a.eigenschaften[e.id] > 0)), e.id);
  }
});

test("das Profil der Person liegt bei jeder Eigenschaft zwischen -1 und 1", () => {
  for (const a of zufallsAntworten(200)) {
    for (const wert of Object.values(profilAus(daten, a))) assert.ok(wert >= -1 && wert <= 1);
  }
});

test("es kommen immer drei verschiedene Vorschläge heraus, der dritte aus einem anderen Bereich", () => {
  for (const a of zufallsAntworten(2000)) {
    const { vorschlaege } = berechne(daten, wegeDaten, a);
    assert.equal(vorschlaege.length, 3);
    assert.equal(new Set(vorschlaege.map((v) => v.id)).size, 3);
    const ersteZwei = [bereich(vorschlaege[0].id), bereich(vorschlaege[1].id)];
    assert.ok(!ersteZwei.includes(bereich(vorschlaege[2].id)));
  }
});

test("jeder der 26 Wege kann vorgeschlagen werden, auch auf Platz 1", () => {
  const dabei = new Set();
  const vorn = new Set();
  for (const a of zufallsAntworten(20000)) {
    const { vorschlaege } = berechne(daten, wegeDaten, a);
    vorn.add(vorschlaege[0].id);
    for (const v of vorschlaege) dabei.add(v.id);
  }
  for (const w of wege) {
    assert.ok(dabei.has(w.id), `${w.id} wird nie vorgeschlagen`);
    assert.ok(vorn.has(w.id), `${w.id} steht nie auf Platz 1`);
  }
});

test("wer gern Fremde anspricht, gestaltet und Betriebe kennt, bekommt Websites für Läden zuerst", () => {
  const { vorschlaege } = berechne(daten, wegeDaten, antworten({ 7: 1, 8: 0, 9: 3, 10: 0, 11: 0, 12: 1, 15: 0, 16: 1, 17: 0, 18: 1, 19: 2, 22: 0, 25: 2, 26: 4 }));
  assert.equal(vorschlaege[0].id, "W");
});

test("wer vor die Kamera will und Geduld hat, bekommt einen Weg vor der Kamera zuerst", () => {
  const { vorschlaege } = berechne(daten, wegeDaten, antworten({ 6: 2, 7: 3, 8: 3, 9: 0, 10: 2, 11: 3, 14: 2, 15: 3, 16: 3, 17: 3, 18: 0, 25: 0, 26: 0 }));
  assert.equal(vorschlaege[0].id, "kanal");
});

test("wer gern verkauft und schnell etwas sehen will, bekommt Reselling zuerst", () => {
  const { vorschlaege } = berechne(daten, wegeDaten, antworten({ 4: 2, 6: 3, 9: 3, 11: 0, 12: 3, 14: 0, 15: 0, 16: 2, 20: 3, 25: 1, 26: 2 }));
  assert.ok(["sneaker", "vintage"].includes(vorschlaege[0].id), vorschlaege[0].id);
});

test("wer Technik mag und Eigenes bauen will, bekommt einen Weg aus KI und Apps zuerst", () => {
  const { vorschlaege } = berechne(daten, wegeDaten, antworten({ 6: 0, 7: 0, 8: 3, 9: 3, 10: 1, 11: 3, 12: 2, 15: 3, 17: 3, 18: 2, 19: 3, 25: 2, 26: 3 }));
  assert.equal(bereich(vorschlaege[0].id), "ki");
  assert.ok(["app", "kitool"].includes(vorschlaege[0].id), vorschlaege[0].id);
});

test("wer nicht vor die Kamera will, bekommt keinen Kamera-Weg auf Platz 1", () => {
  const kamera = wege.filter((w) => w.profil.kamera >= 2).map((w) => w.id);
  for (const a of zufallsAntworten(500)) {
    const { vorschlaege } = berechne(daten, wegeDaten, { ...a, 9: 3, 18: 2 });
    assert.ok(!kamera.includes(vorschlaege[0].id), vorschlaege[0].id);
  }
});

test("der gewählte Bereich gibt einen Vorsprung", () => {
  const basis = antworten({ 25: 3 });
  const ohne = berechne(daten, wegeDaten, basis).passung;
  const mit = berechne(daten, wegeDaten, { ...basis, 25: 1 }).passung;
  for (const w of wege) {
    if (w.bereich === "fashion") assert.ok(mit[w.id] > ohne[w.id], w.id);
    else assert.equal(mit[w.id], ohne[w.id], w.id);
  }
});

test("nur Handy sperrt alle Wege, die einen Laptop brauchen", () => {
  const laptop = wege.filter((w) => w.brauchtLaptop).map((w) => w.id);
  assert.ok(laptop.length > 0);
  for (const a of zufallsAntworten(300)) {
    const ergebnis = berechne(daten, wegeDaten, { ...a, 5: 0 });
    assert.deepEqual(ergebnis.gesperrt.slice().sort(), laptop.slice().sort());
    for (const v of ergebnis.vorschlaege) assert.ok(!laptop.includes(v.id));
  }
});

test("jeder Vorschlag nennt höchstens drei Gründe, den stärksten zuerst", () => {
  for (const a of zufallsAntworten(200)) {
    for (const v of berechne(daten, wegeDaten, a).vorschlaege) {
      assert.ok(v.gruende.length <= 3);
      for (let i = 1; i < v.gruende.length; i++) assert.ok(v.gruende[i - 1].wert >= v.gruende[i].wert);
    }
  }
});

test("gleiche Antworten ergeben immer das gleiche Ergebnis", () => {
  const a = berechne(daten, wegeDaten, antworten({ 9: 0 }));
  const b = berechne(daten, wegeDaten, antworten({ 9: 0 }));
  assert.deepEqual(a, b);
});
