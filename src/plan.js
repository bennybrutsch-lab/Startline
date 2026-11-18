// Macht aus dem festen Gerüst eines Weges einen persönlichen Plan.
// Die Schritte kommen aus daten/weg-*.json. Hier werden sie nur an die Person angepasst.
// Keine KI: gleiche Antworten ergeben immer den gleichen Plan.

// Nummern der Fragen und Antworten, auf die sich die Regeln beziehen.
const F_ALTER = 1; // 0 = unter 16, 1 = 16 oder 17
const F_ZEIT = 3; // 0 = unter 20 Minuten, 3 = mehr als zwei Stunden
const F_FREMDE = 8; // 2 = lieber schriftlich, 3 = bitte nicht
const V_BRANCHE = 1;
const V_ANFAHRT = 2; // 3 = gar nicht, nur online
const V_INHABER = 3; // 0 = ja selbst, 1 = über Familie oder Freunde
const V_WEBSITE = 4; // 0 = mehrere, 1 = eine

function kopie(schritt) {
  return { ...schritt, tun: [...schritt.tun] };
}

// antworten: Antworten auf die 26 Fragen, vertiefung: Antworten auf die Vertiefungsfragen
export function erstellePlan(weg, antworten, vertiefung) {
  const unter18 = antworten[F_ALTER] === 0 || antworten[F_ALTER] === 1;
  const wenigZeit = antworten[F_ZEIT] === 0;
  const vielZeit = antworten[F_ZEIT] === 3;
  const scheu = antworten[F_FREMDE] === 2 || antworten[F_FREMDE] === 3;
  const nurOnline = vertiefung[V_ANFAHRT] === 3;
  const kenntInhaber = vertiefung[V_INHABER] === 0 || vertiefung[V_INHABER] === 1;
  const hatWebsite = vertiefung[V_WEBSITE] === 0 || vertiefung[V_WEBSITE] === 1;
  const branche = weg.vertiefung[V_BRANCHE - 1].antworten[vertiefung[V_BRANCHE]];

  const angewendet = [];
  let schritte = [];

  for (const etappe of weg.etappen) {
    let liste = etappe.schritte.map(kopie);

    // Wer schon eine Website hat, baut kein neues Beispiel, sondern passt die vorhandene an.
    if (etappe.nr === 1 && hatWebsite) {
      liste = liste.filter((s) => s.tag !== 3 && s.tag !== 4);
      const stelle = liste.findIndex((s) => s.tag === 5);
      liste.splice(stelle, 0, {
        tag: 3,
        titel: "Deine Website an die Branche anpassen",
        min: 45,
        tun: [
          "Nimm eine Website, die du schon gebaut hast.",
          "Pass Name, Texte und Bilder so an, dass sie zu einem Betrieb deiner Branche passt.",
          "Prüfe sie am Handy.",
        ],
        fertig: "du ein Beispiel für deine Branche hast.",
      });
    }

    // Wer viel Zeit hat, schafft Etappe 1 in vier Tagen: je zwei Schritte an einem Tag.
    if (etappe.nr === 1 && vielZeit) {
      const zusammen = [];
      for (let i = 0; i < liste.length; i += 2) {
        const a = liste[i];
        const b = liste[i + 1];
        zusammen.push(
          b
            ? { ...a, titel: `${a.titel} und ${b.titel}`, min: a.min + b.min, tun: [...a.tun, ...b.tun], fertig: b.fertig, hinweis: a.hinweis || b.hinweis }
            : a
        );
      }
      liste = zusammen;
    }

    for (const s of liste) schritte.push({ ...s, etappe: etappe.nr, etappeName: etappe.name, ziel: etappe.ziel });
  }
  if (hatWebsite) angewendet.push("Du hast schon eine Website. Du passt sie an, statt ein neues Beispiel zu bauen.");
  if (vielZeit) angewendet.push("Du hast viel Zeit. Die erste Etappe ist auf wenige Tage verkürzt.");

  // Texte anpassen.
  for (const s of schritte) {
    // Die gewählte Branche einsetzen.
    if (branche) s.tun = s.tun.map((t) => t.replace("Betrieben deiner Branche", `Betrieben aus dem Bereich „${branche}“`));

    // Wer einen Inhaber kennt, startet bei ihm.
    if (kenntInhaber && (s.tag === 10 || s.tag === 11)) {
      s.hinweis = "Fang mit dem Betrieb an, dessen Inhaber du kennst." + (s.hinweis ? " " + s.hinweis : "");
    }

    // Wer nicht hinkommt oder ungern Fremde anspricht, nimmt schriftlich Kontakt auf.
    if ((nurOnline || scheu) && [11, 12, 15, 25, 27].includes(s.tag)) {
      s.tun = s.tun.map((t) =>
        t
          .replace(/^Geh in (\w+) (weitere )?Betriebe[^.]*\./, "Schreib $1 $2Betrieben eine kurze Nachricht oder ruf sie an.")
          .replace(/^Sprich (\w+)( davon| weitere| Betriebe)/, "Schreib $1$2")
      );
      if (scheu && !nurOnline && s.tag === 11) {
        s.hinweis = "Du startest schriftlich. Der erste Besuch vor Ort kommt später, wenn du dich sicherer fühlst.";
      }
    }

    // Wer nur online Kontakt aufnimmt, braucht eine längere Liste.
    if (nurOnline && s.tag === 1) {
      s.tun = s.tun.map((t) => t.replace("Schreib 20 auf", "Schreib 40 auf"));
      s.fertig = "40 Betriebe auf deiner Liste stehen.";
    }

    // Unter 18 sind die Gespräche mit den Eltern Pflicht.
    if (unter18 && (s.tag === 8 || s.tag === 17)) {
      s.hinweis = "Pflicht für dich: Ohne deine Eltern geht dieser Schritt nicht. " + (s.hinweis || "");
    }
  }
  if (kenntInhaber) angewendet.push("Du kennst einen Inhaber. Dein erstes Gespräch findet dort statt.");
  if (nurOnline) angewendet.push("Du erreichst die Betriebe nicht vor Ort. Alle Kontakte laufen per Nachricht oder Anruf, deine Liste ist dafür doppelt so lang.");
  else if (scheu) angewendet.push("Fremde ansprechen fällt dir schwer. Du startest mit Nachrichten statt Besuchen.");
  if (unter18) angewendet.push("Du bist unter 18. Die Gespräche mit deinen Eltern stehen fest im Plan.");

  // Wer wenig Zeit hat, bekommt jeden Schritt auf zwei Tage verteilt.
  if (wenigZeit) {
    const geteilt = [];
    for (const s of schritte) {
      if (s.tun.length < 2) {
        geteilt.push(s);
        continue;
      }
      const mitte = Math.ceil(s.tun.length / 2);
      geteilt.push({ ...s, titel: `${s.titel} (Teil 1)`, min: Math.ceil(s.min / 2), tun: s.tun.slice(0, mitte), fertig: "du diese Schritte erledigt hast." });
      // Der Hinweis steht nur beim ersten Teil, damit er nicht doppelt erscheint.
      geteilt.push({ ...s, titel: `${s.titel} (Teil 2)`, min: Math.floor(s.min / 2), tun: s.tun.slice(mitte), hinweis: "" });
    }
    schritte = geteilt;
    angewendet.push("Du hast wenig Zeit am Tag. Jeder Schritt ist auf zwei Tage verteilt, der Plan dauert dafür länger.");
  }

  // Tage neu durchzählen.
  schritte = schritte.map((s, i) => ({
    nr: i + 1,
    etappe: s.etappe,
    etappeName: s.etappeName,
    ziel: s.ziel,
    titel: s.titel,
    min: s.min,
    tun: s.tun,
    fertig: s.fertig,
    hinweis: (s.hinweis || "").trim(),
  }));

  return { schritte, angewendet, tage: schritte.length };
}
