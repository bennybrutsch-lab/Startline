// Das Programm im Browser. Es zeigt immer genau eine Ansicht: Anmelden, Fragen oder Ergebnis.

const $ = (id) => document.getElementById(id);
const ANSICHTEN = ["ansicht-anmelden", "ansicht-fragen", "ansicht-ergebnis"];

let fragen = []; // alle 25 Fragen in einer Liste
let antworten = {}; // Nummer der Frage -> Nummer der gewählten Antwort
let stelle = 0; // welche Frage gerade zu sehen ist

function zeige(ansicht) {
  $("laden").hidden = true;
  for (const id of ANSICHTEN) $(id).hidden = id !== ansicht;
}

// Schickt eine Anfrage an den Server und gibt die Antwort zurück.
async function api(weg, daten) {
  const antwort = await fetch(weg, {
    method: daten ? "POST" : "GET",
    headers: daten ? { "Content-Type": "application/json" } : {},
    body: daten ? JSON.stringify(daten) : undefined,
  });
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
  $("konto").hidden = true;
  zeige("ansicht-anmelden");
});

// ---------- Fragen ----------

function zeigeFrage() {
  const frage = fragen[stelle];
  $("fragen-stand").textContent = `Frage ${stelle + 1} von ${fragen.length}`;
  $("fragen-balken").max = fragen.length;
  $("fragen-balken").value = Object.keys(antworten).length;
  $("fragen-block").textContent = frage.block;
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

  $("knopf-zurueck").disabled = stelle === 0;
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
  if (stelle > 0) stelle -= 1;
  zeigeFrage();
});

$("knopf-weiter").addEventListener("click", async () => {
  if (stelle < fragen.length - 1) {
    stelle += 1;
    zeigeFrage();
  } else {
    await zeigeErgebnis();
  }
});

// ---------- Ergebnis ----------

async function zeigeErgebnis() {
  const ergebnis = await api("/api/ergebnis");
  if (!ergebnis.ok) {
    zeige("ansicht-fragen");
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
    liste.append(karte);
  });
  zeige("ansicht-ergebnis");
}

$("knopf-nochmal").addEventListener("click", () => {
  stelle = 0;
  zeigeFrage();
  zeige("ansicht-fragen");
});

// ---------- Start ----------

async function start() {
  const ich = await api("/api/ich");
  if (!ich.ok) return zeige("ansicht-anmelden");
  $("konto-email").textContent = ich.email;
  $("konto").hidden = false;

  const daten = await api("/api/fragen");
  if (!daten.ok) return zeige("ansicht-anmelden");
  fragen = daten.bloecke.flatMap((block) => block.fragen.map((f) => ({ ...f, block: block.titel })));
  antworten = daten.antworten;

  // Weitermachen, wo man aufgehört hat.
  const offen = fragen.findIndex((f) => antworten[f.nr] === undefined);
  if (offen === -1) return zeigeErgebnis();
  stelle = offen;
  zeigeFrage();
  zeige("ansicht-fragen");
}

start();
