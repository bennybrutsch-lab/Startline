// Das Programm im Browser. Es zeigt immer genau eine Ansicht.
// Nach dem Anmelden kommt die Startseite. Von dort geht es in die Bereiche Plan, Heute und Mentor.

const $ = (id) => document.getElementById(id);
const ANSICHTEN = [
  "ansicht-anmelden",
  "ansicht-einfuehrung",
  "ansicht-start",
  "ansicht-einleitung",
  "ansicht-fragen",
  "ansicht-ergebnis",
  "ansicht-vertiefung",
  "ansicht-heute",
  "ansicht-plan",
  "ansicht-mentor",
];
// Zu welchem Menüpunkt eine Ansicht gehört.
const BEREICH = {
  "ansicht-start": "start",
  "ansicht-einleitung": "plan",
  "ansicht-fragen": "plan",
  "ansicht-ergebnis": "plan",
  "ansicht-vertiefung": "plan",
  "ansicht-plan": "plan",
  "ansicht-heute": "heute",
  "ansicht-mentor": "mentor",
};

let angemeldet = false;
let hatPlan = false;
let bloecke = []; // die Abschnitte mit ihren Fragen
let fragen = []; // alle Fragen in einer Liste
let antworten = {}; // Nummer der Frage -> Nummer der gewählten Antwort
let stelle = 0; // welche Frage gerade zu sehen ist

function zeige(ansicht) {
  $("laden").hidden = true;
  for (const id of ANSICHTEN) $(id).hidden = id !== ansicht;
  // Während der Einführung gibt es noch kein Menü, damit nichts ablenkt.
  $("menue").hidden = !angemeldet || ansicht === "ansicht-einfuehrung";
  $("menue-heute").hidden = !hatPlan;
  for (const name of ["start", "heute", "plan", "mentor"]) {
    $("menue-" + name).setAttribute("aria-current", BEREICH[ansicht] === name ? "page" : "false");
  }
  window.scrollTo(0, 0);
}

// Schickt eine Anfrage an den Server und gibt die Antwort zurück.
async function api(weg, daten) {
  let antwort;
  try {
    antwort = await fetch(weg, {
      method: daten ? "POST" : "GET",
      headers: daten ? { "Content-Type": "application/json" } : {},
      body: daten ? JSON.stringify(daten) : undefined,
    });
  } catch {
    return { ok: false, status: 0, fehler: "Keine Verbindung zum Server." };
  }
  let inhalt = {};
  try {
    inhalt = await antwort.json();
  } catch {
    inhalt = { fehler: "Der Server hat nicht richtig geantwortet." };
  }
  return { ok: antwort.ok, status: antwort.status, ...inhalt };
}

function meldung(id, text) {
  $(id).textContent = text || "";
  $(id).hidden = !text;
}

// ---------- Konto ----------

$("formular-konto").addEventListener("submit", async (ereignis) => {
  ereignis.preventDefault();
  const art = ereignis.submitter?.value === "anmelden" ? "anmelden" : "registrieren";
  meldung("konto-fehler", "");
  const ergebnis = await api("/api/" + art, {
    email: $("email").value,
    passwort: $("passwort").value,
  });
  if (!ergebnis.ok) return meldung("konto-fehler", ergebnis.fehler);
  $("passwort").value = "";
  await start();
});

$("abmelden").addEventListener("click", async () => {
  await api("/api/abmelden", {});
  angemeldet = false;
  hatPlan = false;
  $("konto").hidden = true;
  zeige("ansicht-anmelden");
});

// ---------- Einführung ----------

let einfuehrung = []; // die Seiten der Einführung
let einfuehrungStelle = 0;

async function zeigeEinfuehrung() {
  const daten = await api("/api/einfuehrung");
  if (!daten.ok || !daten.seiten.length) return zeigeStart();
  einfuehrung = daten.seiten;
  einfuehrungStelle = 0;
  zeigeEinfuehrungSeite();
  zeige("ansicht-einfuehrung");
}

function zeigeEinfuehrungSeite() {
  const seite = einfuehrung[einfuehrungStelle];
  const letzte = einfuehrungStelle === einfuehrung.length - 1;
  $("einfuehrung-stand").textContent = `Schritt ${einfuehrungStelle + 1} von ${einfuehrung.length}`;
  $("einfuehrung-balken").max = einfuehrung.length;
  $("einfuehrung-balken").value = einfuehrungStelle + 1;
  $("einfuehrung-titel").textContent = seite.titel;

  const inhalt = $("einfuehrung-inhalt");
  inhalt.replaceChildren();
  for (const text of seite.text || []) {
    const absatz = document.createElement("p");
    absatz.textContent = text;
    inhalt.append(absatz);
  }
  if (seite.punkte) {
    const liste = document.createElement("ol");
    for (const text of seite.punkte) {
      const punkt = document.createElement("li");
      punkt.textContent = text;
      liste.append(punkt);
    }
    inhalt.append(liste);
  }

  $("einfuehrung-weiter").textContent = letzte ? "Zur Übersicht" : "Weiter";
  $("einfuehrung-zurueck").hidden = einfuehrungStelle === 0;
  $("einfuehrung-ueberspringen").hidden = letzte;
  window.scrollTo(0, 0);
}

async function beendeEinfuehrung() {
  await api("/api/einfuehrung/gesehen", {});
  await zeigeStart();
}

$("einfuehrung-weiter").addEventListener("click", () => {
  if (einfuehrungStelle === einfuehrung.length - 1) return beendeEinfuehrung();
  einfuehrungStelle += 1;
  zeigeEinfuehrungSeite();
});
$("einfuehrung-zurueck").addEventListener("click", () => {
  if (einfuehrungStelle > 0) einfuehrungStelle -= 1;
  zeigeEinfuehrungSeite();
});
$("einfuehrung-ueberspringen").addEventListener("click", beendeEinfuehrung);
$("start-einfuehrung-knopf").addEventListener("click", zeigeEinfuehrung);

// ---------- Startseite ----------

async function zeigeStart() {
  const s = await api("/api/stand");
  if (!s.ok) return zeige("ansicht-anmelden");
  hatPlan = Boolean(s.plan);

  // Die Startseite stellt eine Frage. Die Antworten hängen davon ab, wie weit man ist.
  const auswahl = [];

  if (hatPlan) {
    const fertig = s.plan.geschafft >= s.plan.gesamt;
    auswahl.push({
      id: "wahl-heute",
      titel: fertig ? "Ansehen, was ich geschafft habe" : "Die Aufgabe von heute",
      text: fertig ? "Du hast alle Tage geschafft." : `Tag ${s.plan.geschafft + 1} von ${s.plan.gesamt}. Eine Aufgabe am Tag reicht.`,
      los: () => zeigeHeute(),
    });
  }

  const plan = {
    neu: ["Meinen Plan gestalten", "In etwa zehn Minuten findest du heraus, welcher Weg zu dir passt."],
    fragen: ["Mit den Fragen weitermachen", `Du bist bei Frage ${Math.min(s.fragen.beantwortet + 1, s.fragen.anzahl)} von ${s.fragen.anzahl}. Deine Antworten sind gespeichert.`],
    ergebnis: ["Meinen Weg wählen", "Deine drei Wege stehen fest. Sieh sie dir an und such dir einen aus."],
    vertiefung: ["Meinen Plan fertig machen", `Dein Weg: ${s.weg}. Noch sechs kurze Fragen.`],
    plan: ["Meinen ganzen Plan ansehen", s.plan ? `${s.weg}. ${s.plan.geschafft} von ${s.plan.gesamt} Tagen geschafft.` : ""],
  }[s.stand];
  auswahl.push({ id: "wahl-plan", titel: plan[0], text: plan[1], los: oeffnePlanBereich });

  auswahl.push({
    id: "wahl-mentor",
    titel: s.mentor ? "Meinen Mentor ändern" : "Meinen Mentor einrichten",
    text: s.mentor ? `Er redet gerade so mit dir: ${s.mentor}.` : "Leg fest, wie dein Mentor mit dir reden soll.",
    los: () => zeigeMentor(),
  });

  const neuHier = s.stand === "neu" && !s.mentor;
  $("start-frage").textContent = neuHier ? "Womit willst du anfangen?" : "Womit willst du weitermachen?";
  $("start-text").textContent = neuHier
    ? "Startline hilft dir herauszufinden, womit du loslegen kannst. Such dir aus, wo du startest."
    : "Die erste Möglichkeit ist dein nächster Schritt.";

  const kasten = $("start-auswahl");
  kasten.replaceChildren();
  auswahl.forEach((wahl, nummer) => {
    const knopf = document.createElement("button");
    knopf.type = "button";
    knopf.id = wahl.id;
    // Die erste Möglichkeit ist der empfohlene nächste Schritt und fällt deshalb am stärksten auf.
    knopf.className = nummer === 0 ? "" : "zweit";
    const titel = document.createElement("strong");
    titel.textContent = wahl.titel;
    const text = document.createElement("span");
    text.textContent = wahl.text;
    knopf.append(titel, text);
    knopf.addEventListener("click", wahl.los);
    kasten.append(knopf);
  });

  zeige("ansicht-start");
}

// Der Bereich "Plan" öffnet immer den Schritt, bei dem man gerade ist.
async function oeffnePlanBereich() {
  const s = await api("/api/stand");
  if (!s.ok) return zeige("ansicht-anmelden");
  hatPlan = Boolean(s.plan);
  if (s.stand === "plan") return zeigePlan();
  if (s.stand === "vertiefung") return zeigeVertiefung();
  if (s.stand === "ergebnis") return zeigeErgebnis();
  if (s.stand === "fragen") return oeffneFragen();
  $("einleitung-anzahl").textContent = s.fragen.anzahl;
  zeige("ansicht-einleitung");
}

$("menue-start").addEventListener("click", zeigeStart);
$("menue-plan").addEventListener("click", oeffnePlanBereich);
$("menue-heute").addEventListener("click", () => zeigeHeute());
$("menue-mentor").addEventListener("click", () => zeigeMentor());
$("knopf-los").addEventListener("click", () => oeffneFragen());
$("knopf-einleitung-zurueck").addEventListener("click", zeigeStart);

// ---------- Fragen ----------

async function ladeFragen() {
  const daten = await api("/api/fragen");
  if (!daten.ok) return false;
  bloecke = daten.bloecke;
  fragen = bloecke.flatMap((block, nummer) =>
    block.fragen.map((f) => ({ ...f, block: block.titel, warum: block.warum, blockNr: nummer + 1 }))
  );
  antworten = daten.antworten;
  return true;
}

// Öffnet die Fragen an der ersten Stelle, die noch offen ist.
async function oeffneFragen(vonVorn = false) {
  if (!(await ladeFragen())) return zeige("ansicht-anmelden");
  const offen = fragen.findIndex((f) => antworten[f.nr] === undefined);
  stelle = vonVorn || offen === -1 ? 0 : offen;
  zeigeFrage();
  zeige("ansicht-fragen");
}

function zeigeFrage() {
  const frage = fragen[stelle];
  $("fragen-stand").textContent = `Frage ${stelle + 1} von ${fragen.length}`;
  $("fragen-balken").max = fragen.length;
  $("fragen-balken").value = Object.keys(antworten).length;
  $("fragen-block").textContent = `Abschnitt ${frage.blockNr} von ${bloecke.length}: ${frage.block}`;
  $("fragen-warum").textContent = frage.warum || "";
  $("frage-text").textContent = frage.text;
  meldung("fragen-fehler", "");

  const kasten = $("frage-antworten");
  kasten.replaceChildren();
  frage.antworten.forEach((text, nummer) => {
    const knopf = document.createElement("button");
    knopf.type = "button";
    knopf.textContent = text;
    knopf.setAttribute("aria-pressed", antworten[frage.nr] === nummer ? "true" : "false");
    knopf.addEventListener("click", () => waehle(frage, nummer));
    kasten.append(knopf);
  });

  $("knopf-zurueck").textContent = stelle === 0 ? "Zur Übersicht" : "Zurück";
  $("knopf-weiter").disabled = antworten[frage.nr] === undefined;
  $("knopf-weiter").textContent = stelle === fragen.length - 1 ? "Auswerten" : "Weiter";
}

async function waehle(frage, nummer) {
  const vorher = antworten[frage.nr];
  antworten[frage.nr] = nummer;
  zeigeFrage();
  const ergebnis = await api("/api/antworten", { frage: frage.nr, antwort: nummer });
  if (!ergebnis.ok) {
    // Speichern hat nicht geklappt: Auswahl zurücknehmen und Bescheid sagen.
    if (vorher === undefined) delete antworten[frage.nr];
    else antworten[frage.nr] = vorher;
    zeigeFrage();
    meldung("fragen-fehler", ergebnis.fehler || "Die Antwort konnte nicht gespeichert werden.");
  }
}

$("knopf-zurueck").addEventListener("click", () => {
  if (stelle === 0) return zeigeStart();
  stelle -= 1;
  zeigeFrage();
});

$("knopf-weiter").addEventListener("click", async () => {
  if (stelle < fragen.length - 1) {
    stelle += 1;
    zeigeFrage();
    window.scrollTo(0, 0);
  } else {
    await zeigeErgebnis();
  }
});

// ---------- Ergebnis ----------

async function zeigeErgebnis() {
  const ergebnis = await api("/api/ergebnis");
  if (!ergebnis.ok) {
    await oeffneFragen();
    return meldung("fragen-fehler", ergebnis.fehler);
  }
  $("ergebnis-hinweis").textContent = ergebnis.knapp
    ? "Deine drei Wege liegen fast gleichauf. Probier am besten aus jedem eine kleine Aufgabe aus, bevor du dich entscheidest."
    : "Der erste Weg passt nach deinen Antworten am besten. Die anderen zwei sind echte Alternativen.";

  const liste = $("ergebnis-liste");
  liste.replaceChildren();
  ergebnis.vorschlaege.forEach((v, nummer) => {
    const karte = document.createElement("div");
    karte.className = "vorschlag";

    const titel = document.createElement("h2");
    titel.textContent = `${nummer + 1}. ${v.name}`;
    if (!v.verfuegbar) {
      const marke = document.createElement("span");
      marke.className = "marke";
      marke.textContent = "Plan kommt bald";
      titel.append(marke);
    }

    const kurz = document.createElement("p");
    kurz.textContent = v.kurz;

    const warum = document.createElement("p");
    warum.textContent = "Das spricht nach deinen Antworten dafür:";
    const gruende = document.createElement("ul");
    for (const g of v.gruende) {
      const punkt = document.createElement("li");
      punkt.textContent = `${g.frage} – ${g.antwort}`;
      gruende.append(punkt);
    }

    const daten = document.createElement("p");
    daten.className = "daten";
    daten.textContent = `Schwierigkeit: ${v.schwierigkeit}. Erstes Geld ${v.erstesGeld}, ohne Garantie. Erster Schritt: ${v.ersterSchritt}`;

    karte.append(titel, kurz);
    if (v.gruende.length) karte.append(warum, gruende);
    karte.append(daten);

    const knopf = document.createElement("button");
    knopf.type = "button";
    knopf.textContent = v.verfuegbar ? "Diesen Weg wählen" : "Plan kommt bald";
    knopf.disabled = !v.verfuegbar;
    knopf.addEventListener("click", () => waehleWeg(v.id));
    karte.append(knopf);
    liste.append(karte);
  });
  meldung("ergebnis-fehler", "");
  zeige("ansicht-ergebnis");
}

async function waehleWeg(richtung) {
  const ergebnis = await api("/api/weg", { richtung });
  if (!ergebnis.ok) return meldung("ergebnis-fehler", ergebnis.fehler);
  await zeigeVertiefung();
}

$("knopf-nochmal").addEventListener("click", () => oeffneFragen(true));

// ---------- Vertiefung ----------

async function zeigeVertiefung() {
  const daten = await api("/api/vertiefung");
  if (!daten.ok) return zeigeErgebnis();
  $("vertiefung-weg").textContent = daten.weg.name;
  $("vertiefung-ehrlich").textContent = daten.weg.ehrlich;
  meldung("vertiefung-fehler", "");

  const kasten = $("vertiefung-fragen");
  kasten.replaceChildren();
  for (const frage of daten.fragen) {
    const gruppe = document.createElement("fieldset");
    const titel = document.createElement("legend");
    titel.textContent = `${frage.nr}. ${frage.text}`;
    gruppe.append(titel);
    frage.antworten.forEach((text, nummer) => {
      const zeile = document.createElement("label");
      const wahl = document.createElement("input");
      wahl.type = "radio";
      wahl.name = "v" + frage.nr;
      wahl.id = `v${frage.nr}-${nummer}`;
      wahl.value = nummer;
      wahl.checked = daten.antworten[frage.nr] === nummer;
      const schrift = document.createElement("span");
      schrift.textContent = text;
      zeile.append(wahl, schrift);
      gruppe.append(zeile);
    });
    kasten.append(gruppe);
  }
  zeige("ansicht-vertiefung");
}

$("formular-vertiefung").addEventListener("submit", async (ereignis) => {
  ereignis.preventDefault();
  const gewaehlt = {};
  for (const wahl of document.querySelectorAll("#vertiefung-fragen input:checked")) {
    gewaehlt[Number(wahl.name.slice(1))] = Number(wahl.value);
  }
  const ergebnis = await api("/api/plan/erstellen", { antworten: gewaehlt });
  if (!ergebnis.ok) return meldung("vertiefung-fehler", ergebnis.fehler);
  hatPlan = true;
  await zeigeHeute();
});

async function andererWeg() {
  await api("/api/weg/abwaehlen", {});
  hatPlan = false;
  await zeigeErgebnis();
}
$("knopf-anderer-weg").addEventListener("click", andererWeg);
$("knopf-plan-neu").addEventListener("click", andererWeg);

// ---------- Heute ----------

let vorausArbeiten = false; // true, wenn jemand heute freiwillig noch eine Aufgabe machen will

async function zeigeHeute() {
  // Das Anpassen durch die KI kann ein paar Sekunden dauern.
  $("laden").textContent = "Deine Aufgabe wird vorbereitet …";
  $("laden").hidden = false;
  const daten = await api("/api/heute");
  $("laden").textContent = "Lädt …";
  if (!daten.ok) return zeigeStart();
  hatPlan = true;
  meldung("heute-fehler", "");
  $("heute-stand").textContent = `${daten.geschafft} von ${daten.gesamt} Tagen geschafft`;
  $("heute-balken").max = daten.gesamt;
  $("heute-balken").value = daten.geschafft;

  const allesFertig = !daten.schritt;
  const pause = daten.heuteErledigt && !vorausArbeiten && !allesFertig;

  // Kasten "geschafft": nach dem Abhaken oder wenn der ganze Plan durch ist.
  $("heute-geschafft").hidden = !(pause || allesFertig);
  if (allesFertig) {
    $("heute-geschafft-titel").textContent = "Du hast den ganzen Plan geschafft.";
    $("heute-geschafft-text").textContent = "Das schaffen die wenigsten. Schau dir im Plan an, was du alles gemacht hast.";
  } else if (pause) {
    $("heute-geschafft-titel").textContent = "Für heute geschafft.";
    $("heute-geschafft-text").textContent = `Morgen geht es weiter mit Tag ${daten.schritt.nr}: ${daten.schritt.titel}.`;
  }
  $("knopf-weitermachen").hidden = allesFertig;
  $("knopf-rueckgaengig").hidden = !daten.letzter;

  // Die Aufgabe selbst.
  $("heute-aufgabe").hidden = pause || allesFertig;
  if (!pause && !allesFertig) {
    const s = daten.schritt;
    $("heute-titel").textContent = `Tag ${s.nr}: ${s.titel}`;
    $("heute-persoenlich").hidden = !s.persoenlich;
    $("heute-dauer").textContent = `Etappe ${s.etappe}: ${s.etappeName} · ca. ${s.min} Minuten`;
    const liste = $("heute-schritte");
    liste.replaceChildren();
    for (const text of s.tun) {
      const punkt = document.createElement("li");
      punkt.textContent = text;
      liste.append(punkt);
    }
    $("heute-fertig").textContent = `Fertig, wenn ${s.fertig}`;
    meldung("heute-hinweis", s.hinweis);
    $("knopf-erledigt").dataset.nr = s.nr;
  }
  zeige("ansicht-heute");
}

$("knopf-erledigt").addEventListener("click", async () => {
  const ergebnis = await api("/api/schritt/erledigt", { nr: Number($("knopf-erledigt").dataset.nr) });
  if (!ergebnis.ok) return meldung("heute-fehler", ergebnis.fehler);
  vorausArbeiten = false;
  await zeigeHeute();
});

$("knopf-weitermachen").addEventListener("click", async () => {
  vorausArbeiten = true;
  await zeigeHeute();
});

$("knopf-rueckgaengig").addEventListener("click", async () => {
  await api("/api/schritt/zurueck", {});
  vorausArbeiten = true;
  await zeigeHeute();
});

// ---------- Plan ----------

async function zeigePlan() {
  const daten = await api("/api/plan");
  if (!daten.ok) return zeigeStart();
  hatPlan = true;
  const minuten = daten.schritte.reduce((summe, s) => summe + s.min, 0);
  $("plan-weg").textContent = daten.weg.name;
  $("plan-umfang").textContent = `${daten.schritte.length} Tage, im Schnitt ${Math.round(minuten / daten.schritte.length)} Minuten pro Tag.`;

  const angepasst = $("plan-angepasst");
  angepasst.replaceChildren();
  angepasst.className = daten.angewendet.length ? "kasten" : "";
  if (daten.angewendet.length) {
    const titel = document.createElement("strong");
    titel.textContent = "So wurde der Plan an dich angepasst:";
    const punkte = document.createElement("ul");
    for (const text of daten.angewendet) {
      const punkt = document.createElement("li");
      punkt.textContent = text;
      punkte.append(punkt);
    }
    angepasst.append(titel, punkte);
  }

  const liste = $("plan-liste");
  liste.replaceChildren();
  const naechster = daten.schritte.find((s) => !s.erledigt)?.nr;
  let etappe = 0;
  for (const s of daten.schritte) {
    if (s.etappe !== etappe) {
      etappe = s.etappe;
      const kopf = document.createElement("div");
      kopf.className = "etappe";
      const titel = document.createElement("h2");
      titel.textContent = `Etappe ${s.etappe}: ${s.etappeName}`;
      const ziel = document.createElement("p");
      ziel.textContent = s.ziel;
      kopf.append(titel, ziel);
      liste.append(kopf);
    }
    const tag = document.createElement("div");
    tag.className = "tag" + (s.erledigt ? " erledigt" : "") + (s.nr === naechster ? " naechster" : "");
    const titel = document.createElement("h3");
    titel.textContent = `Tag ${s.nr}: ${s.titel}` + (s.erledigt ? " (erledigt)" : "");
    if (s.persoenlich) {
      const marke = document.createElement("span");
      marke.className = "marke";
      marke.textContent = "Für dich angepasst";
      titel.append(" ", marke);
    }
    const dauer = document.createElement("p");
    dauer.className = "daten";
    dauer.textContent = `ca. ${s.min} Minuten`;
    const schritte = document.createElement("ol");
    for (const text of s.tun) {
      const punkt = document.createElement("li");
      punkt.textContent = text;
      schritte.append(punkt);
    }
    const fertig = document.createElement("p");
    fertig.className = "daten";
    fertig.textContent = `Fertig, wenn ${s.fertig}`;
    tag.append(titel, dauer, schritte, fertig);
    if (s.hinweis) {
      const hinweis = document.createElement("p");
      hinweis.className = "hinweis";
      hinweis.textContent = s.hinweis;
      tag.append(hinweis);
    }
    liste.append(tag);
  }
  zeige("ansicht-plan");
}

// ---------- Mentor ----------

async function zeigeMentor() {
  const daten = await api("/api/mentor");
  if (!daten.ok) return zeige("ansicht-anmelden");
  const eingerichtet = daten.ton !== null;

  // Einstellungen: vor dem Einrichten offen, danach eingeklappt.
  $("mentor-einstellungen").open = !eingerichtet;
  $("mentor-einstellungen-titel").textContent = eingerichtet ? `Stil ändern (gerade: ${daten.toene[daten.ton].name})` : "Mentor einrichten";
  $("mentor-stand").textContent = eingerichtet
    ? `Aktueller Stil: ${daten.toene[daten.ton].name}.`
    : "Bevor ihr loslegt: Wähle, wie dein Mentor mit dir reden soll.";
  $("mentor-frage").textContent = daten.frage;
  $("mentor-hinweis").textContent = daten.hinweis;
  meldung("mentor-fehler", "");
  meldung("mentor-gespeichert", "");

  const kasten = $("mentor-toene");
  kasten.replaceChildren();
  daten.toene.forEach((ton, nummer) => {
    const zeile = document.createElement("label");
    const wahl = document.createElement("input");
    wahl.type = "radio";
    wahl.name = "ton";
    wahl.id = "ton-" + nummer;
    wahl.value = nummer;
    wahl.checked = daten.ton === nummer;
    const schrift = document.createElement("span");
    const name = document.createElement("strong");
    name.textContent = ton.name + ". ";
    schrift.append(name, ton.kurz);
    zeile.append(wahl, schrift);
    kasten.append(zeile);
  });

  // Das Gespräch gibt es erst, wenn der Mentor eingerichtet ist.
  $("mentor-chat").hidden = !eingerichtet;
  if (eingerichtet) await ladeGespraech();
  zeige("ansicht-mentor");
}

function blase(rolle, text, leise = false) {
  const element = document.createElement("div");
  element.className = "blase " + (rolle === "user" ? "ich" : "mentor") + (leise ? " leise" : "");
  element.textContent = text;
  $("chat-verlauf").append(element);
  return element;
}

async function ladeGespraech() {
  const daten = await api("/api/mentor/gespraech");
  $("chat-verlauf").replaceChildren();
  meldung("chat-fehler", "");
  $("mentor-nicht-verbunden").hidden = !daten.ok || daten.verbunden;
  if (!daten.ok) return meldung("chat-fehler", daten.fehler);
  if (!daten.nachrichten.length) {
    blase("assistant", "Hi, ich bin dein Mentor. Frag mich, wenn du bei einer Aufgabe festhängst, nicht weißt, wie du anfangen sollst, oder eine ehrliche Meinung willst.", true);
  }
  for (const n of daten.nachrichten) blase(n.rolle, n.text);
}

$("formular-chat").addEventListener("submit", async (ereignis) => {
  ereignis.preventDefault();
  const text = $("chat-eingabe").value.trim();
  if (!text) return meldung("chat-fehler", "Schreib zuerst eine Nachricht.");
  meldung("chat-fehler", "");
  $("chat-senden").disabled = true;
  blase("user", text);
  $("chat-eingabe").value = "";
  const warten = blase("assistant", "Dein Mentor schreibt …", true);
  const ergebnis = await api("/api/mentor/nachricht", { text });
  warten.remove();
  $("chat-senden").disabled = false;
  if (!ergebnis.ok) {
    // Nicht geschickt: Text zurück ins Feld, damit nichts verloren geht.
    $("chat-verlauf").lastElementChild?.remove();
    $("chat-eingabe").value = text;
    return meldung("chat-fehler", ergebnis.fehler);
  }
  blase("assistant", ergebnis.text, ergebnis.nichtVerbunden);
  $("chat-eingabe").focus();
});

// Mit Strg+Enter oder Cmd+Enter abschicken.
$("chat-eingabe").addEventListener("keydown", (ereignis) => {
  if (ereignis.key === "Enter" && (ereignis.ctrlKey || ereignis.metaKey)) $("formular-chat").requestSubmit();
});

$("formular-mentor").addEventListener("submit", async (ereignis) => {
  ereignis.preventDefault();
  const wahl = document.querySelector("#mentor-toene input:checked");
  meldung("mentor-gespeichert", "");
  const ergebnis = await api("/api/mentor", { ton: wahl ? Number(wahl.value) : null });
  if (!ergebnis.ok) return meldung("mentor-fehler", ergebnis.fehler);
  await zeigeMentor();
  $("mentor-einstellungen").open = true;
  meldung("mentor-gespeichert", "Gespeichert.");
});

// ---------- Start ----------

async function start() {
  const ich = await api("/api/ich");
  angemeldet = ich.ok;
  if (!ich.ok) return zeige("ansicht-anmelden");
  $("konto-email").textContent = ich.email;
  $("konto").hidden = false;
  // Beim ersten Anmelden kommt zuerst die Einführung.
  const stand = await api("/api/stand");
  if (stand.ok && !stand.einfuehrungGesehen) return zeigeEinfuehrung();
  await zeigeStart();
}

start();
