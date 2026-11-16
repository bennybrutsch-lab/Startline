// Prüft die Punkteberechnung. Starten mit: npm test
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { alleFragen, berechne } from "../src/punkte.js";

const daten = JSON.parse(readFileSync(new URL("../daten/fragen.json", import.meta.url), "utf8"));
const fragen = alleFragen(daten);

// Hilfe: überall die erste Antwort, außer dort, wo etwas anderes angegeben ist.
function antworten(abweichungen = {}) {
  const alle = {};
  for (const f of fragen) alle[f.nr] = 1;
  return { ...alle, ...abweichungen };
}

test("es gibt 25 Fragen mit je mindestens zwei Antworten", () => {
  assert.equal(fragen.length, 25);
  fragen.forEach((f, i) => {
    assert.equal(f.nr, i + 1);
    assert.ok(f.antworten.length >= 2);
  });
});

test("alle Punkte gehören zu einer bekannten Richtung", () => {
  const bekannt = daten.richtungen.map((r) => r.id);
  for (const f of fragen) {
    for (const a of f.antworten) {
      for (const richtung of Object.keys(a.punkte)) assert.ok(bekannt.includes(richtung), `${richtung} in Frage ${f.nr}`);
    }
  }
});

test("es kommen immer drei verschiedene Vorschläge heraus", () => {
  for (let wahl = 0; wahl < 3; wahl++) {
    const alle = {};
    for (const f of fragen) alle[f.nr] = Math.min(wahl, f.antworten.length - 1);
    const { vorschlaege } = berechne(daten, alle);
    assert.equal(vorschlaege.length, 3);
    assert.equal(new Set(vorschlaege.map((v) => v.id)).size, 3);
  }
});

test("wer gern Fremde anspricht und Betriebe kennt, bekommt Websites für Betriebe zuerst", () => {
  const { vorschlaege } = berechne(
    daten,
    antworten({ 6: 1, 8: 0, 10: 0, 11: 0, 15: 0, 17: 0, 22: 0 })
  );
  assert.equal(vorschlaege[0].id, "W");
});

test("wer vor die Kamera will, bekommt Öffentlich bauen zuerst", () => {
  const { vorschlaege } = berechne(daten, antworten({ 6: 2, 7: 3, 9: 0, 10: 2, 11: 3, 15: 3, 16: 3, 18: 0 }));
  assert.equal(vorschlaege[0].id, "K");
});

test("nur Handy sperrt alle Richtungen, die einen Laptop brauchen", () => {
  const ergebnis = berechne(daten, antworten({ 5: 0, 6: 0, 7: 0, 13: 2, 19: 3 }));
  const laptop = daten.richtungen.filter((r) => r.brauchtLaptop).map((r) => r.id);
  assert.deepEqual(ergebnis.gesperrt.sort(), laptop.sort());
  for (const v of ergebnis.vorschlaege) assert.ok(!laptop.includes(v.id));
});

test("der dritte Vorschlag kommt aus einer anderen Gruppe als die ersten zwei", () => {
  const { vorschlaege } = berechne(daten, antworten({ 8: 0, 10: 0, 15: 0, 17: 0, 20: 2, 22: 0 }));
  const gruppe = (id) => daten.richtungen.find((r) => r.id === id).gruppe;
  const ersteZwei = [gruppe(vorschlaege[0].id), gruppe(vorschlaege[1].id)];
  assert.ok(!ersteZwei.includes(gruppe(vorschlaege[2].id)));
});

test("jeder Vorschlag nennt höchstens drei Gründe, den stärksten zuerst", () => {
  const { vorschlaege } = berechne(daten, antworten({ 8: 0, 22: 0 }));
  for (const v of vorschlaege) {
    assert.ok(v.gruende.length <= 3);
    for (let i = 1; i < v.gruende.length; i++) assert.ok(v.gruende[i - 1].wert >= v.gruende[i].wert);
  }
});

test("gleiche Antworten ergeben immer das gleiche Ergebnis", () => {
  const a = berechne(daten, antworten({ 9: 0 }));
  const b = berechne(daten, antworten({ 9: 0 }));
  assert.deepEqual(a, b);
});
