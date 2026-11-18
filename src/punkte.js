// Rechnet aus den Antworten auf die 26 Fragen die drei Vorschläge aus.
// Hier steckt keine KI drin: gleiche Antworten ergeben immer das gleiche Ergebnis.
//
// So geht es:
// 1. Jede Antwort sammelt Eigenschaften (daten/fragen.json). Daraus entsteht das Profil der Person.
// 2. Jeder Weg hat ein Profil aus denselben Eigenschaften (daten/wege.json).
// 3. Vorgeschlagen werden die Wege, deren Profil dem der Person am ähnlichsten ist.

// Frage 5 fragt nach den Geräten. Antwort 0 heißt "Nur mit dem Handy".
const FRAGE_GERAET = 5;
const ANTWORT_NUR_HANDY = 0;

// Vorsprung für Wege aus dem Bereich, den die Person bei "Welcher Bereich reizt dich am meisten?" wählt.
// Die Übereinstimmung liegt zwischen -1 und 1.
const BONUS_BEREICH = 0.12;

// Liegen der erste und der dritte Vorschlag so nah beieinander, gilt das Ergebnis als knapp.
const KNAPP_ABSTAND = 0.05;

// Alle Fragen aus den Blöcken als eine flache Liste.
export function alleFragen(daten) {
  return daten.bloecke.flatMap((block) => block.fragen);
}

// Wie viel man von jeder Eigenschaft höchstens sammeln kann. Damit werden alle Eigenschaften vergleichbar,
// auch wenn manche in vielen Fragen vorkommen und andere nur in einer.
function hoechstwerte(daten) {
  const max = {};
  for (const e of daten.eigenschaften) max[e.id] = 0;
  for (const frage of alleFragen(daten)) {
    for (const e of daten.eigenschaften) {
      const bester = Math.max(0, ...frage.antworten.map((a) => a.eigenschaften[e.id] || 0));
      max[e.id] += bester;
    }
  }
  return max;
}

// Das Profil der Person: pro Eigenschaft ein Wert zwischen -1 (gar nicht) und 1 (sehr stark).
export function profilAus(daten, antworten) {
  const max = hoechstwerte(daten);
  const summe = {};
  for (const e of daten.eigenschaften) summe[e.id] = 0;
  for (const frage of alleFragen(daten)) {
    const antwort = frage.antworten[antworten[frage.nr]];
    if (!antwort) continue;
    for (const [e, wert] of Object.entries(antwort.eigenschaften)) summe[e] += wert;
  }
  const profil = {};
  for (const e of daten.eigenschaften) {
    profil[e.id] = max[e.id] ? Math.max(-1, Math.min(1, summe[e.id] / max[e.id])) : 0;
  }
  return profil;
}

// Wie ähnlich sind sich das Profil der Person und das Profil eines Weges? 1 = gleiche Richtung, 0 = nichts gemeinsam.
function aehnlichkeit(person, weg) {
  let produkt = 0;
  let laengePerson = 0;
  let laengeWeg = 0;
  for (const [e, wert] of Object.entries(person)) {
    const gewicht = weg[e] || 0;
    produkt += wert * gewicht;
    laengePerson += wert * wert;
    laengeWeg += gewicht * gewicht;
  }
  if (!laengePerson || !laengeWeg) return 0;
  return produkt / Math.sqrt(laengePerson * laengeWeg);
}

// antworten: { "1": 2, "2": 0, ... }  (Nummer der Frage -> Nummer der gewählten Antwort)
export function berechne(daten, wegeDaten, antworten) {
  const fragen = alleFragen(daten);
  const max = hoechstwerte(daten);
  const profil = profilAus(daten, antworten);
  const wege = wegeDaten.wege;

  // 1. Welchen Bereich hat die Person gewählt, falls einen?
  let wunsch = null;
  for (const frage of fragen) {
    const antwort = frage.antworten[antworten[frage.nr]];
    if (antwort && antwort.bereich) wunsch = { bereich: antwort.bereich, frage: frage.text, antwort: antwort.text };
  }

  // 2. Übereinstimmung für jeden Weg ausrechnen.
  const passung = {};
  for (const w of wege) {
    passung[w.id] = aehnlichkeit(profil, w.profil) + (wunsch && wunsch.bereich === w.bereich ? BONUS_BEREICH : 0);
  }

  // 3. Rahmen prüfen: Wer nur ein Handy hat, bekommt keinen Weg, der einen Laptop braucht.
  const nurHandy = antworten[FRAGE_GERAET] === ANTWORT_NUR_HANDY;
  const gesperrt = wege.filter((w) => nurHandy && w.brauchtLaptop).map((w) => w.id);

  // 4. Nach Übereinstimmung sortieren. Bei Gleichstand gilt die Reihenfolge aus der Datei.
  const moeglich = wege
    .filter((w) => !gesperrt.includes(w.id))
    .map((w, stelle) => ({ w, stelle }))
    .sort((a, b) => passung[b.w.id] - passung[a.w.id] || a.stelle - b.stelle)
    .map((x) => x.w);

  // 5. Drei Vorschläge: die zwei besten, dazu der beste aus einem anderen Bereich,
  //    damit nicht drei fast gleiche Wege zur Wahl stehen.
  const auswahl = moeglich.slice(0, 2);
  const bereiche = auswahl.map((w) => w.bereich);
  const rest = moeglich.slice(2);
  const dritter = rest.find((w) => !bereiche.includes(w.bereich)) || rest[0];
  if (dritter) auswahl.push(dritter);

  const vorschlaege = auswahl.map((w) => ({
    id: w.id,
    name: w.name,
    bereich: wegeDaten.bereiche.find((b) => b.id === w.bereich)?.name || "",
    kurz: w.kurz,
    passung: passung[w.id],
    schwierigkeit: w.schwierigkeit,
    erstesGeld: w.erstesGeld,
    ersterSchritt: w.ersterSchritt,
    verfuegbar: w.verfuegbar,
    gruende: gruende(fragen, antworten, w, max, wunsch),
  }));

  // 6. Liegen die drei fast gleichauf, soll der Mentor zum Ausprobieren raten.
  const knapp =
    vorschlaege.length === 3 && vorschlaege[0].passung - vorschlaege[2].passung <= KNAPP_ABSTAND;

  return { profil, passung, gesperrt, vorschlaege, knapp, beantwortet: Object.keys(antworten).length };
}

// Die drei Antworten, die am meisten für diesen Weg sprechen, die stärkste zuerst.
function gruende(fragen, antworten, weg, max, wunsch) {
  const liste = [];
  if (wunsch && wunsch.bereich === weg.bereich) liste.push({ frage: wunsch.frage, antwort: wunsch.antwort, wert: 1 });
  for (const frage of fragen) {
    const antwort = frage.antworten[antworten[frage.nr]];
    if (!antwort) continue;
    let wert = 0;
    for (const [e, punkte] of Object.entries(antwort.eigenschaften)) {
      if (max[e]) wert += ((weg.profil[e] || 0) * punkte) / max[e];
    }
    if (wert > 0) liste.push({ frage: frage.text, antwort: antwort.text, wert });
  }
  return liste.sort((a, b) => b.wert - a.wert).slice(0, 3);
}
