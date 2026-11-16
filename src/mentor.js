// Der Mentor: baut aus den Daten des Nutzers die Anweisung für die KI und stellt die Frage.
// Die KI ist Claude von Anthropic. Ohne Schlüssel in ANTHROPIC_API_KEY antwortet der Mentor nicht.

import Anthropic from "@anthropic-ai/sdk";

// Welches Modell antwortet. Lässt sich über die Einstellung MENTOR_MODELL ändern.
const STANDARD_MODELL = "claude-opus-5-5";
export const MAX_ZEICHEN = 2000; // längste erlaubte Nachricht
export const MAX_PRO_TAG = 30; // Nachrichten pro Nutzer und Tag, als Kostenbremse
const VERLAUF_LAENGE = 30; // so viele frühere Nachrichten bekommt die KI mit

const TON = [
  "Rede locker und auf Augenhöhe, wie ein älterer Bruder, der es schon gemacht hat. Kurze Sätze, kein Fachchinesisch.",
  "Rede fordernd wie ein Coach. Benenne klar, was als Nächstes zu tun ist, und lass keine Ausreden durchgehen, ohne unfreundlich zu werden.",
  "Rede ruhig und geduldig. Erkläre Schritt für Schritt und dränge nicht.",
  "Rede kurz und direkt. Komm sofort zum Punkt, höchstens drei Sätze, wenn nicht mehr nötig ist.",
];

// Der feste Teil der Anweisung. Er ist für alle Nutzer gleich.
const REGELN = `Du bist der Mentor in der App Startline. Startline hilft jungen Leuten zwischen 14 und 25, etwas Eigenes aufzubauen: Sie beantworten Fragen, wählen einen Weg und bekommen einen Plan mit einer Aufgabe pro Tag. Du begleitest sie dabei.

Wer du bist:
- Du bist eine KI. Wenn jemand fragt, ob du ein Mensch bist, sagst du klar, dass du eine KI bist.
- Du kennst die Antworten, den Weg und den Plan der Person. Sie stehen weiter unten. Beziehe dich darauf, statt allgemein zu antworten.

Wie du hilfst:
- Antworte auf Deutsch, in einfacher Sprache und mit du.
- Halte dich kurz. Meist reichen wenige Sätze und ein konkreter nächster Schritt.
- Gib einen Schritt, den die Person heute schaffen kann, statt einer langen Liste.
- Wenn jemand festhängt, frag zuerst nach, woran genau, bevor du Lösungen vorschlägst.
- Sei ehrlich, auch wenn es unangenehm ist. Wenn eine Idee schwach ist oder jemand sich etwas schönredet, sag es klar und sag, was besser wäre.
- Erfinde nichts. Wenn du etwas nicht weißt, sag das.

Was du nie tust:
- Du versprichst kein Einkommen und nennst keine Beträge, die jemand verdienen wird.
- Du tust nicht so, als wäre es leicht oder als würde es jeder schaffen.
- Du gibst keine Anlageempfehlungen, also keine Tipps, bestimmte Aktien, Kryptowährungen oder andere Geldanlagen zu kaufen. Allgemeines Geldwissen erklären ist in Ordnung.
- Du rätst zu nichts Riskantem: keine Kredite, kein Glücksspiel, kein Zocken.
- Du rätst nie dazu, Schule, Ausbildung oder Studium abzubrechen. Sie gehen vor.
- Du gibst keine Rechtsberatung. Bei Gewerbe, Verträgen, Rechnungen und Steuern erklärst du nur allgemein und verweist auf Eltern, Gewerbeamt oder Steuerberater.
- Wer unter 18 ist, braucht für Aufträge, Verträge und ein Gewerbe die Eltern. Daran erinnerst du, wenn es darum geht.

Wenn es der Person schlecht geht:
- Wenn jemand von großen Sorgen, Angst, Druck zu Hause, Mobbing oder Gedanken schreibt, sich etwas anzutun, nimmst du das ernst und gehst zuerst darauf ein. Das Geschäftliche kann warten.
- Nenne dann Hilfe: die Nummer gegen Kummer 116 111 (kostenlos, für Kinder und Jugendliche), die Telefonseelsorge 0800 111 0 111 und bei akuter Gefahr den Notruf 112. Ermutige dazu, mit einem Erwachsenen zu sprechen, dem die Person vertraut.

Bleib beim Thema: Du hilfst beim Weg, beim Plan und bei allem, was dazugehört. Bei ganz anderen Themen sagst du freundlich, dass du dafür nicht da bist.`;

function zeilen(titel, liste) {
  return liste.length ? `${titel}\n${liste.map((z) => "- " + z).join("\n")}` : "";
}

// Baut den persönlichen Teil der Anweisung: Was weiß der Mentor über diese Person?
export function baueKontext({ ton, fragen, antworten, weg, vertiefung, schritte }) {
  const teile = [];
  teile.push(`So sollst du reden: ${TON[ton] || TON[2]}`);

  const beantwortet = fragen
    .filter((f) => antworten[f.nr] !== undefined && f.antworten[antworten[f.nr]])
    .map((f) => `${f.text} ${f.antworten[antworten[f.nr]].text}`);
  teile.push(
    beantwortet.length
      ? zeilen(`Antworten der Person auf die Fragen (${beantwortet.length} von ${fragen.length}):`, beantwortet)
      : "Die Person hat die Fragen noch nicht beantwortet. Du kennst sie also noch kaum. Sag das offen und empfiehl, im Bereich Plan zu starten."
  );

  if (weg) {
    teile.push(`Gewählter Weg: ${weg.name}. ${weg.kurz}`);
    const zusatz = weg.vertiefung
      .map((f, i) => (vertiefung[i + 1] !== undefined ? `${f.frage} ${f.antworten[vertiefung[i + 1]]}` : null))
      .filter(Boolean);
    if (zusatz.length) teile.push(zeilen("Weitere Angaben zum Weg:", zusatz));
  } else {
    teile.push("Die Person hat noch keinen Weg gewählt und noch keinen Plan.");
  }

  if (schritte.length) {
    const geschafft = schritte.filter((s) => s.erledigt).length;
    const offen = schritte.find((s) => !s.erledigt);
    teile.push(`Plan: ${schritte.length} Tage, davon ${geschafft} geschafft.`);
    if (offen) {
      teile.push(
        `Aktuelle Aufgabe, Tag ${offen.nr}: ${offen.titel} (Etappe ${offen.etappe}: ${offen.etappeName}, ca. ${offen.min} Minuten)\n` +
          offen.tun.map((t, i) => `${i + 1}. ${t}`).join("\n") +
          `\nFertig, wenn ${offen.fertig}` +
          (offen.hinweis ? `\nHinweis: ${offen.hinweis}` : "")
      );
      const danach = schritte.filter((s) => s.nr > offen.nr).slice(0, 5).map((s) => `Tag ${s.nr}: ${s.titel}`);
      if (danach.length) teile.push(zeilen("Danach kommen:", danach));
    } else {
      teile.push("Die Person hat alle Tage des Plans geschafft.");
    }
  }
  return teile.filter(Boolean).join("\n\n");
}

// ---------- Tagesaufgabe persönlich anpassen ----------

const ANPASSEN = `Du passt in der App Startline die Aufgabe eines Tages an eine bestimmte Person an. Die Person ist zwischen 14 und 25 und will etwas Eigenes aufbauen.

Du bekommst eine geprüfte Vorlage für die Aufgabe und alles, was über die Person bekannt ist. Schreib die Aufgabe so um, dass sie sich anfühlt, als wäre sie nur für diese Person geschrieben.

So passt du an:
- Nutze, was du über die Person weißt: Branche, Kontakte, Zeit, Vorwissen, Alter, und vor allem Namen, Orte und Details, die sie im Gespräch mit dem Mentor erwähnt hat.
- Mach die Schritte konkreter als die Vorlage, aber nicht länger. Zwei bis vier Schritte, jeder ein klarer Satz.
- Schreib auf Deutsch, mit du, in einfacher Sprache.

Was gleich bleiben muss:
- Das Ziel der Aufgabe und woran man merkt, dass sie fertig ist. Du darfst es nur konkreter formulieren.
- Die ungefähre Dauer. Mach die Aufgabe nicht deutlich größer.
- Hinweise zu Eltern, Gewerbe, Rechnungen und rechtlichen Dingen. Die bleiben inhaltlich erhalten und werden nie weggelassen.

Was du nie tust:
- Nichts über die Person erfinden. Wenn du etwas nicht weißt, bleib allgemein.
- Keine Einkommen versprechen, nichts Riskantes vorschlagen, nicht zum Abbruch von Schule oder Ausbildung raten.
- Keine Schritte aus späteren Tagen vorziehen.

Gib das Ergebnis im vorgegebenen Format zurück. "hinweis" ist ein leerer Text, wenn es keinen Hinweis braucht.`;

const AUFGABE_FORMAT = {
  type: "json_schema",
  schema: {
    type: "object",
    properties: {
      titel: { type: "string" },
      tun: { type: "array", items: { type: "string" } },
      fertig: { type: "string" },
      hinweis: { type: "string" },
    },
    required: ["titel", "tun", "fertig", "hinweis"],
    additionalProperties: false,
  },
};

// Prüft, ob die angepasste Aufgabe brauchbar ist. Sonst gilt die Vorlage.
export function pruefeAngepasst(daten, vorlage) {
  if (!daten || typeof daten !== "object") return null;
  const { titel, tun, fertig, hinweis } = daten;
  if (typeof titel !== "string" || !titel.trim() || titel.length > 120) return null;
  if (!Array.isArray(tun) || tun.length < 1 || tun.length > 5) return null;
  if (tun.some((t) => typeof t !== "string" || !t.trim() || t.length > 400)) return null;
  if (typeof fertig !== "string" || !fertig.trim() || fertig.length > 300) return null;
  if (typeof hinweis !== "string" || hinweis.length > 400) return null;
  // Ein Pflicht-Hinweis aus der Vorlage darf nie verloren gehen.
  const neuerHinweis = hinweis.trim() || (vorlage.hinweis || "");
  return {
    titel: titel.trim(),
    tun: tun.map((t) => t.trim()),
    // Die App schreibt "Fertig, wenn" davor. Steht es schon da, wird es entfernt.
    fertig: fertig.trim().replace(/^fertig,?\s*wenn\s*/i, ""),
    hinweis: neuerHinweis,
  };
}

// Schreibt eine Tagesaufgabe für die Person um. Gibt die angepasste Aufgabe oder null zurück.
export async function passeAufgabeAn(env, kontext, schritt, gespraech) {
  if (!env.ANTHROPIC_API_KEY) return null;
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const vorlage = {
    tag: schritt.nr,
    titel: schritt.titel,
    minuten: schritt.min,
    schritte: schritt.tun,
    fertig_wenn: schritt.fertig,
    hinweis: schritt.hinweis || "",
  };
  const ausGespraech = gespraech.length
    ? "Aus dem Gespräch mit dem Mentor (neueste zuletzt):\n" +
      gespraech.map((n) => (n.rolle === "user" ? "Person: " : "Mentor: ") + n.text.slice(0, 500)).join("\n")
    : "Mit dem Mentor wurde noch nicht gesprochen.";
  try {
    const antwort = await client.beta.messages.create({
      model: env.MENTOR_MODELL || STANDARD_MODELL,
      max_tokens: 16000,
      output_config: { effort: "low", format: AUFGABE_FORMAT },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: [
        { type: "text", text: ANPASSEN, cache_control: { type: "ephemeral" } },
        { type: "text", text: "Was über die Person bekannt ist:\n\n" + kontext + "\n\n" + ausGespraech },
      ],
      messages: [{ role: "user", content: "Vorlage für die heutige Aufgabe:\n" + JSON.stringify(vorlage, null, 2) }],
    });
    if (antwort.stop_reason !== "end_turn") return null;
    const text = antwort.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    return pruefeAngepasst(JSON.parse(text), schritt);
  } catch (fehler) {
    // Klappt das Anpassen nicht, bekommt die Person einfach die Vorlage. Das ist kein Grund für eine Fehlermeldung.
    console.error("Aufgabe anpassen fehlgeschlagen:", fehler?.status || "", fehler?.message || fehler);
    return null;
  }
}

// Aus den gespeicherten Nachrichten die Liste für die KI machen. Sie muss mit einer Nutzer-Nachricht beginnen.
export function baueVerlauf(nachrichten) {
  const letzte = nachrichten.slice(-VERLAUF_LAENGE);
  const start = letzte.findIndex((n) => n.rolle === "user");
  return (start === -1 ? [] : letzte.slice(start)).map((n) => ({ role: n.rolle, content: n.text }));
}

// Stellt die Frage an die KI. Gibt { text } oder { fehler } zurück.
export async function frageMentor(env, kontext, verlauf) {
  if (!env.ANTHROPIC_API_KEY) {
    return {
      nichtVerbunden: true,
      text: "Der Mentor ist noch nicht verbunden. Dafür fehlt der Schlüssel für die KI. Deine Nachricht ist gespeichert, eine Antwort gibt es aber erst, wenn der Schlüssel hinterlegt ist.",
    };
  }
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  try {
    const antwort = await client.beta.messages.create({
      model: env.MENTOR_MODELL || STANDARD_MODELL,
      max_tokens: 16000,
      // Kurze Gespräche brauchen wenig Nachdenken. Das hält Antworten schnell und günstig.
      output_config: { effort: "low" },
      // Lehnt das Modell eine Anfrage ab, versucht es die Schnittstelle selbst mit einem anderen Modell.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      // Der feste Teil steht vorn und bleibt gleich, damit er zwischengespeichert werden kann.
      system: [
        { type: "text", text: REGELN, cache_control: { type: "ephemeral" } },
        { type: "text", text: kontext },
      ],
      messages: verlauf,
    });
    if (antwort.stop_reason === "refusal") {
      return { text: "Dabei kann ich dir nicht helfen. Frag mich gern etwas zu deinem Weg oder deinem Plan." };
    }
    const text = antwort.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();
    if (!text) return { fehler: "Der Mentor hat keine Antwort gegeben. Versuch es noch einmal." };
    return { text };
  } catch (fehler) {
    if (fehler instanceof Anthropic.AuthenticationError) {
      console.error("Mentor: Der Schlüssel für die KI ist ungültig.");
      return { fehler: "Der Mentor ist gerade nicht erreichbar." };
    }
    if (fehler instanceof Anthropic.RateLimitError) {
      return { fehler: "Der Mentor hat gerade zu viel zu tun. Versuch es in einer Minute noch einmal." };
    }
    if (fehler instanceof Anthropic.APIConnectionError) {
      return { fehler: "Keine Verbindung zum Mentor. Versuch es gleich noch einmal." };
    }
    if (fehler instanceof Anthropic.APIError) {
      console.error("Mentor: Fehler der KI-Schnittstelle", fehler.status, fehler.message);
      return { fehler: "Der Mentor konnte gerade nicht antworten. Versuch es noch einmal." };
    }
    throw fehler;
  }
}
