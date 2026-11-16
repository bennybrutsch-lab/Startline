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
