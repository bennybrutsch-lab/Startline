// Rechnet aus den Antworten auf die 25 Fragen die drei Vorschläge aus.
// Hier steckt keine KI drin: gleiche Antworten ergeben immer das gleiche Ergebnis.

// Frage 5 fragt nach den Geräten. Antwort 0 heißt "Nur mit dem Handy".
const FRAGE_GERAET = 5;
const ANTWORT_NUR_HANDY = 0;

// Alle Fragen aus den Blöcken als eine flache Liste.
export function alleFragen(daten) {
  return daten.bloecke.flatMap((block) => block.fragen);
}

// antworten: { "1": 2, "2": 0, ... }  (Nummer der Frage -> Nummer der gewählten Antwort)
export function berechne(daten, antworten) {
  const fragen = alleFragen(daten);
  const punkte = {};
  const beitraege = {};
  for (const r of daten.richtungen) {
    punkte[r.id] = 0;
    beitraege[r.id] = [];
  }

  // 1. Punkte zählen und merken, welche Antwort wie viel beigetragen hat.
  for (const frage of fragen) {
    const gewaehlt = antworten[frage.nr];
    if (gewaehlt === undefined) continue;
    const antwort = frage.antworten[gewaehlt];
    if (!antwort) continue;
    for (const [richtung, wert] of Object.entries(antwort.punkte)) {
      punkte[richtung] += wert;
      beitraege[richtung].push({ frage: frage.text, antwort: antwort.text, wert });
    }
  }

  // 2. Rahmen prüfen: Wer nur ein Handy hat, bekommt keine Richtung, die einen Laptop braucht.
  const nurHandy = antworten[FRAGE_GERAET] === ANTWORT_NUR_HANDY;
  const gesperrt = daten.richtungen
    .filter((r) => nurHandy && r.brauchtLaptop)
    .map((r) => r.id);

  // 3. Nach Punkten sortieren. Bei Gleichstand gilt die Reihenfolge aus der Datei.
  const moeglich = daten.richtungen
    .filter((r) => !gesperrt.includes(r.id))
    .map((r, stelle) => ({ r, stelle }))
    .sort((a, b) => punkte[b.r.id] - punkte[a.r.id] || a.stelle - b.stelle)
    .map((x) => x.r);

  // 4. Drei Vorschläge: die zwei besten, dazu der beste aus einer anderen Gruppe,
  //    damit nicht drei fast gleiche Wege zur Wahl stehen.
  const auswahl = moeglich.slice(0, 2);
  const gruppen = auswahl.map((r) => r.gruppe);
  const rest = moeglich.slice(2);
  const dritter = rest.find((r) => !gruppen.includes(r.gruppe)) || rest[0];
  if (dritter) auswahl.push(dritter);

  const vorschlaege = auswahl.map((r) => ({
    id: r.id,
    name: r.name,
    kurz: r.kurz,
    punkte: punkte[r.id],
    schwierigkeit: r.schwierigkeit,
    erstesGeld: r.erstesGeld,
    ersterSchritt: r.ersterSchritt,
    verfuegbar: r.verfuegbar,
    // Die drei Antworten, die am meisten zu diesem Vorschlag beigetragen haben.
    gruende: beitraege[r.id]
      .slice()
      .sort((a, b) => b.wert - a.wert)
      .slice(0, 3),
  }));

  // 5. Liegen die drei fast gleichauf, soll der Mentor zum Ausprobieren raten.
  const knapp =
    vorschlaege.length === 3 && vorschlaege[0].punkte - vorschlaege[2].punkte <= 2;

  return { punkte, gesperrt, vorschlaege, knapp, beantwortet: Object.keys(antworten).length };
}
