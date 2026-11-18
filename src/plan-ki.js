// Schreibt für die neuen Wege einen persönlichen Plan für 30 Tage.
// Die KI bekommt den Steckbrief des Weges (daten/wege.json) und die Antworten der Person.
// Sie schreibt den Plan in einem festen Format. Die App prüft ihn, bevor er gespeichert wird.
// Der Website-Weg läuft nicht hier durch. Er hat seinen handgeschriebenen Plan (src/plan.js).

import Anthropic from "@anthropic-ai/sdk";

// Welches Modell den Plan schreibt. Lässt sich über die Einstellung MENTOR_MODELL ändern.
const STANDARD_MODELL = "claude-opus-5-5";
export const TAGE = 30;
export const MAX_PLAENE_PRO_TAG = 3; // KI-Pläne pro Nutzer und Tag, als Kostenbremse
const VERSUCHE = 2; // Fällt der erste Plan durch die Prüfung, gibt es genau einen zweiten Versuch.

// Bis zu welchem Tag welche Etappe geht: Tag 1 bis 7, 8 bis 14, 15 bis 22, 23 bis 30.
const ETAPPEN_ENDE = [7, 14, 22, 30];

// Nummern der Fragen und Antworten, auf die sich die Regeln beziehen.
const F_ALTER = 1; // 0 = unter 16, 1 = 16 oder 17
const F_ZEIT = 3; // 0 = unter 20 Minuten, 1 = 20 bis 60, 2 = ein bis zwei Stunden, 3 = mehr
// Wie lang eine Tagesaufgabe höchstens dauern darf, je nach Antwort auf die Frage nach der Zeit.
const MINUTEN_HOECHSTENS = [20, 45, 75, 120];

const ELTERN_HINWEIS =
  "Pflicht für dich: Du bist unter 18. Besprich mit deinen Eltern, was du vorhast, bevor du ein Konto anlegst, etwas verkaufst oder einen Auftrag annimmst.";

const REGELN = `Du schreibst in der App Startline einen persönlichen Plan für 30 Tage. Die Person ist zwischen 14 und 25 und will etwas Eigenes aufbauen. Sie hat Fragen über sich beantwortet und einen Weg gewählt. Jeden Tag bekommt sie genau eine Aufgabe aus deinem Plan und hakt sie ab.

Du bekommst den Steckbrief des Weges und alles, was über die Person bekannt ist. Der Steckbrief ist geprüft und gibt das Gerüst vor: vier Etappen, jede mit einem Ziel und drei Meilensteinen.

So baust du den Plan:
- Genau 30 Tage. Etappe 1 ist Tag 1 bis 7, Etappe 2 ist Tag 8 bis 14, Etappe 3 ist Tag 15 bis 22, Etappe 4 ist Tag 23 bis 30.
- Am letzten Tag einer Etappe sind ihre drei Meilensteine erreicht und ihr Ziel ist erfüllt. Jeder Meilenstein wird durch mindestens einen Tag erreicht.
- Jeder Tag baut auf den Tagen davor auf. Tag 1 ist der erste Schritt aus dem Steckbrief oder etwas genauso Kleines.
- Der letzte Tag jeder Etappe enthält einen kurzen Rückblick: Was lief gut, was war schwer.
- Jede Aufgabe ist an einem Tag zu schaffen und passt in die Zeit, die die Person am Tag hat. Die Obergrenze in Minuten steht bei den Angaben zur Person.
- Jeder Tag hat zwei bis vier Schritte. Jeder Schritt ist ein klarer Satz, der sagt, was genau zu tun ist.
- "fertig_wenn" ist ein Halbsatz, der den Satz "Fertig, wenn ..." beendet, zum Beispiel "drei Videos online sind". Man muss es eindeutig prüfen können.

So passt du an die Person an:
- Nutze ihre Antworten: Zeit, Geld, Geräte, Vorwissen, was ihr liegt, und vor allem die Angaben zum Weg.
- Wer etwas schon kann oder hat, überspringt die Grundlagen und geht dafür weiter.
- Wer kein Geld einsetzen kann, bekommt nur Schritte ohne Kosten.
- Wer ungern Fremde anspricht, startet schriftlich und im eigenen Umfeld.
- Schreib in "anpassungen" zwei bis vier kurze Sätze, was du für diese Person angepasst hast. Sprich sie mit du an, zum Beispiel "Du hast wenig Zeit am Tag. Die Aufgaben sind deshalb kurz."

Was im Plan stehen muss:
- Die rechtlichen Hinweise aus dem Steckbrief. Setz jeden als "hinweis" an den Tag, an dem er zum ersten Mal wichtig wird.
- Ist die Person unter 18: ein Gespräch mit den Eltern, bevor ein Konto angelegt, etwas verkauft oder ein Auftrag angenommen wird. Der Hinweis an diesem Tag beginnt mit "Pflicht für dich:".
- "hinweis" ist ein leerer Text, wenn es an dem Tag keinen Hinweis braucht.

Was du nie tust:
- Kein Einkommen versprechen und keine Beträge nennen, die jemand verdienen wird.
- Nichts Riskantes: keine Kredite, kein Glücksspiel, kein Geld einsetzen, das die Person nicht hat.
- Nie dazu raten, Schule, Ausbildung oder Studium zu vernachlässigen.
- Nichts über die Person erfinden. Wenn du etwas nicht weißt, bleib allgemein.
- Keine Rechtsberatung. Bei Gewerbe, Verträgen und Steuern verweist du auf Eltern, Gewerbeamt oder Steuerberater.

Schreib auf Deutsch, mit du, in einfacher Sprache und ohne Fachchinesisch. Gib das Ergebnis im vorgegebenen Format zurück.`;

const PLAN_FORMAT = {
  type: "json_schema",
  schema: {
    type: "object",
    properties: {
      tage: {
        type: "array",
        items: {
          type: "object",
          properties: {
            tag: { type: "integer" },
            titel: { type: "string" },
            minuten: { type: "integer" },
            schritte: { type: "array", items: { type: "string" } },
            fertig_wenn: { type: "string" },
            hinweis: { type: "string" },
          },
          required: ["tag", "titel", "minuten", "schritte", "fertig_wenn", "hinweis"],
          additionalProperties: false,
        },
      },
      anpassungen: { type: "array", items: { type: "string" } },
    },
    required: ["tage", "anpassungen"],
    additionalProperties: false,
  },
};

function istUnter18(antworten) {
  return antworten[F_ALTER] === 0 || antworten[F_ALTER] === 1;
}

function minutenHoechstens(antworten) {
  return MINUTEN_HOECHSTENS[antworten[F_ZEIT]] ?? MINUTEN_HOECHSTENS[1];
}

// Zu welcher Etappe ein Tag gehört. Das legt die App fest, nicht die KI.
export function etappeFuerTag(tag) {
  return ETAPPEN_ENDE.findIndex((ende) => tag <= ende) + 1;
}

// Baut den Auftrag an die KI: Steckbrief des Weges und alles über die Person.
export function bauePlanAuftrag(weg, fragen, antworten, vertiefung) {
  const steckbrief = {
    weg: weg.name,
    beschreibung: weg.kurz,
    ehrlich: weg.ehrlich,
    erster_schritt: weg.ersterSchritt,
    rechtliche_hinweise: weg.recht,
    etappen: weg.etappen.map((e) => ({ nr: e.nr, name: e.name, tage: e.tage, ziel: e.ziel, meilensteine: e.meilensteine })),
  };
  const person = fragen
    .filter((f) => f.antworten[antworten[f.nr]])
    .map((f) => `- ${f.text} ${f.antworten[antworten[f.nr]].text}`);
  const zumWeg = weg.vertiefung
    .map((f, i) => (f.antworten[vertiefung[i + 1]] !== undefined ? `- ${f.frage} ${f.antworten[vertiefung[i + 1]]} (${f.wozu})` : null))
    .filter(Boolean);
  return [
    "Steckbrief des Weges:\n" + JSON.stringify(steckbrief, null, 2),
    "Antworten der Person auf die Fragen:\n" + person.join("\n"),
    "Angaben der Person zum Weg:\n" + zumWeg.join("\n"),
    `Eine Tagesaufgabe darf höchstens ${minutenHoechstens(antworten)} Minuten dauern.` +
      (istUnter18(antworten) ? "\nDie Person ist unter 18." : "\nDie Person ist volljährig."),
    "Schreib jetzt den Plan für 30 Tage.",
  ].join("\n\n");
}

const kurz = (wert, laenge) => typeof wert === "string" && wert.trim().length > 0 && wert.length <= laenge;

// Prüft den Plan der KI. Gibt { schritte, angewendet } zurück oder { fehler } mit dem Grund.
// Die Schritte haben dieselbe Form wie beim handgeschriebenen Plan aus src/plan.js.
export function pruefePlan(daten, weg, antworten) {
  if (!daten || typeof daten !== "object" || !Array.isArray(daten.tage)) return { fehler: "Das Format stimmt nicht." };
  if (daten.tage.length !== TAGE) return { fehler: `Der Plan hat ${daten.tage.length} statt ${TAGE} Tage.` };
  const hoechstens = minutenHoechstens(antworten);
  const schritte = [];
  for (let i = 0; i < TAGE; i++) {
    const t = daten.tage[i];
    const nr = i + 1;
    if (!t || typeof t !== "object") return { fehler: `Tag ${nr} fehlt.` };
    if (t.tag !== nr) return { fehler: `Tag ${nr} hat die falsche Nummer.` };
    if (!kurz(t.titel, 120)) return { fehler: `Tag ${nr}: Der Titel fehlt oder ist zu lang.` };
    if (!Array.isArray(t.schritte) || t.schritte.length < 1 || t.schritte.length > 5) return { fehler: `Tag ${nr}: Es müssen ein bis fünf Schritte sein.` };
    if (t.schritte.some((s) => !kurz(s, 400))) return { fehler: `Tag ${nr}: Ein Schritt fehlt oder ist zu lang.` };
    if (!kurz(t.fertig_wenn, 300)) return { fehler: `Tag ${nr}: Es fehlt, woran man merkt, dass der Tag fertig ist.` };
    if (typeof t.hinweis !== "string" || t.hinweis.length > 500) return { fehler: `Tag ${nr}: Der Hinweis ist zu lang.` };
    if (!Number.isInteger(t.minuten) || t.minuten < 5 || t.minuten > 180) return { fehler: `Tag ${nr}: Die Dauer passt nicht.` };
    const etappe = weg.etappen[etappeFuerTag(nr) - 1];
    schritte.push({
      nr,
      etappe: etappe.nr,
      etappeName: etappe.name,
      ziel: etappe.ziel,
      titel: t.titel.trim(),
      // Die Aufgabe darf nie länger sein, als die Person am Tag Zeit hat.
      min: Math.min(t.minuten, hoechstens),
      tun: t.schritte.map((s) => s.trim()),
      // Die App schreibt "Fertig, wenn" davor. Steht es schon da, wird es entfernt.
      fertig: t.fertig_wenn.trim().replace(/^fertig,?\s*wenn\s*/i, ""),
      hinweis: t.hinweis.trim(),
    });
  }
  if (new Set(schritte.map((s) => s.titel)).size < TAGE - 3) return { fehler: "Zu viele Tage haben denselben Titel." };

  // Unter 18 muss das Gespräch mit den Eltern im Plan stehen. Fehlt es, setzt die App es selbst an Tag 1.
  if (istUnter18(antworten) && !schritte.some((s) => /eltern/i.test(s.hinweis))) {
    schritte[0].hinweis = ELTERN_HINWEIS + (schritte[0].hinweis ? " " + schritte[0].hinweis : "");
  }

  const angewendet = Array.isArray(daten.anpassungen)
    ? daten.anpassungen.filter((a) => kurz(a, 300)).slice(0, 6).map((a) => a.trim())
    : [];
  return { schritte, angewendet, tage: schritte.length };
}

// Lässt die KI den Plan schreiben. Gibt { plan } oder { fehler, status } zurück.
export async function schreibePlan(env, weg, fragen, antworten, vertiefung) {
  if (!env.ANTHROPIC_API_KEY) return { fehler: "Für diesen Weg gibt es noch keinen Plan.", status: 409 };
  // KI_ADRESSE ist nur für Tests gedacht. Im Normalfall bleibt sie leer und die App spricht mit Anthropic.
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, ...(env.KI_ADRESSE ? { baseURL: env.KI_ADRESSE } : {}) });
  const auftrag = bauePlanAuftrag(weg, fragen, antworten, vertiefung);
  let grund = "";
  for (let versuch = 1; versuch <= VERSUCHE; versuch++) {
    try {
      // Der Plan ist lang. Mit stream() bricht die Verbindung nicht ab, während die KI schreibt.
      const antwort = await client.beta.messages
        .stream({
          model: env.MENTOR_MODELL || STANDARD_MODELL,
          max_tokens: 32000,
          output_config: { effort: "medium", format: PLAN_FORMAT },
          // Lehnt das Modell eine Anfrage ab, versucht es die Schnittstelle selbst mit einem anderen Modell.
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          system: [{ type: "text", text: REGELN, cache_control: { type: "ephemeral" } }],
          messages: [
            {
              role: "user",
              content: grund ? `${auftrag}\n\nDein letzter Plan wurde nicht angenommen: ${grund} Achte diesmal darauf.` : auftrag,
            },
          ],
        })
        .finalMessage();
      if (antwort.stop_reason !== "end_turn") {
        grund = "Der Plan war nicht vollständig.";
        console.error("Plan schreiben: abgebrochen mit", antwort.stop_reason);
        continue;
      }
      const text = antwort.content.filter((b) => b.type === "text").map((b) => b.text).join("");
      let daten = null;
      try {
        daten = JSON.parse(text);
      } catch {
        grund = "Das Format stimmt nicht.";
        continue;
      }
      const plan = pruefePlan(daten, weg, antworten);
      if (!plan.fehler) return { plan };
      grund = plan.fehler;
      console.error("Plan schreiben: Prüfung nicht bestanden.", plan.fehler);
    } catch (fehler) {
      if (fehler instanceof Anthropic.AuthenticationError) {
        console.error("Plan schreiben: Der Schlüssel für die KI ist ungültig.");
        return { fehler: "Der Plan kann gerade nicht geschrieben werden.", status: 502 };
      }
      if (fehler instanceof Anthropic.RateLimitError) {
        return { fehler: "Gerade ist zu viel los. Versuch es in einer Minute noch einmal.", status: 502 };
      }
      if (fehler instanceof Anthropic.APIConnectionError) {
        return { fehler: "Keine Verbindung zur KI. Versuch es gleich noch einmal.", status: 502 };
      }
      if (fehler instanceof Anthropic.APIError) {
        console.error("Plan schreiben: Fehler der KI-Schnittstelle", fehler.status, fehler.message);
        return { fehler: "Der Plan konnte gerade nicht geschrieben werden. Versuch es noch einmal.", status: 502 };
      }
      throw fehler;
    }
  }
  // Die KI hat geschrieben, aber der Plan hat die Prüfung nicht bestanden. Das zählt für die Kostenbremse.
  return { fehler: "Der Plan konnte gerade nicht geschrieben werden. Versuch es noch einmal.", status: 502, gezaehlt: true };
}
