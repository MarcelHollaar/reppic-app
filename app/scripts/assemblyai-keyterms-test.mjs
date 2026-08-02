#!/usr/bin/env node
/**
 * AssemblyAI keyterms + Universal-3 Pro — vergelijkings-testscript.
 *
 * Draait dezelfde audio in meerdere configuraties naast elkaar zodat je de
 * kwaliteitswinst van keyterms + een nieuwer model ZIET vóór we iets in de
 * productiecode aanpassen. Dependency-vrij (Node 18+ fetch), leest de key uit
 * app/.env.
 *
 * GEBRUIK:
 *   node app/scripts/assemblyai-keyterms-test.mjs \
 *     --audio "https://.../opname.mp3" \
 *     --keyterms "The Sales Studios,Reppic,PICA,Front talk,Power Pitch" \
 *     --expect "Reppic,PICA,Front talk" \
 *     [--model universal-3-pro] [--baseline-model universal-2]
 *
 *   --audio          Publieke of geldig-gesignde audio-URL (AssemblyAI haalt hem zelf op).
 *                    LET OP: Recall-opname-URL's verlopen; gebruik een verse bron.
 *   --keyterms       Komma-lijst met keyterms voor configuratie C (of --keyterms-file <pad>).
 *   --expect         Komma-lijst met termen die je in het transcript verwacht (voor de scoretelling).
 *   --model          Kandidaat-model (default: universal-3-pro).
 *   --baseline-model Baseline-model (default: leeg = account-default, = huidige productie).
 *
 * Draait drie configuraties:
 *   A. Baseline        (huidige productie: language_detection + speaker_labels)
 *   B. Kandidaat-model (speech_model, geen keyterms)
 *   C. Kandidaat + keyterms (speech_model + keyterms_prompt)
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH = path.resolve(__dirname, "..", ".env");
const API = "https://api.assemblyai.com/v2/transcript";

function readEnvKey() {
  if (process.env.ASSEMBLYAI_API_KEY) return process.env.ASSEMBLYAI_API_KEY;
  try {
    const line = fs
      .readFileSync(ENV_PATH, "utf8")
      .split("\n")
      .find((l) => l.startsWith("ASSEMBLYAI_API_KEY="));
    if (line) return line.slice("ASSEMBLYAI_API_KEY=".length).replace(/^["']|["']$/g, "").trim();
  } catch {}
  return null;
}

function arg(name, def = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

const KEY = readEnvKey();
if (!KEY) {
  console.error("Geen ASSEMBLYAI_API_KEY gevonden (env of app/.env).");
  process.exit(1);
}

const audio = arg("audio");
if (!audio) {
  console.error("Verplicht: --audio <url>. Zie de kop van dit script voor gebruik.");
  process.exit(1);
}
const keytermsFile = arg("keyterms-file");
const keyterms = (keytermsFile
  ? fs.readFileSync(keytermsFile, "utf8").split(/[\n,]/)
  : (arg("keyterms", "") || "").split(","))
  .map((s) => s.trim())
  .filter(Boolean);
const expect = (arg("expect", "") || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const model = arg("model", "universal-3-5-pro");
const baselineModel = arg("baseline-model", null);

const headers = { authorization: KEY, "content-type": "application/json" };

async function submit(body) {
  const res = await fetch(API, { method: "POST", headers, body: JSON.stringify(body) });
  const json = await res.json();
  if (!res.ok) throw new Error(`submit ${res.status}: ${JSON.stringify(json)}`);
  return json.id;
}

async function poll(id) {
  for (let i = 0; i < 240; i++) {
    const res = await fetch(`${API}/${id}`, { headers });
    const j = await res.json();
    if (j.status === "completed") return j;
    if (j.status === "error") throw new Error(`transcript error: ${j.error}`);
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error("timeout (20 min)");
}

function toText(t) {
  if (Array.isArray(t.utterances) && t.utterances.length) {
    return t.utterances.map((u) => `Speaker ${u.speaker}: ${u.text}`).join("\n");
  }
  return t.text || "";
}

function scoreExpect(text) {
  // Woordgrens-match (case-insensitief) zodat "POS" niet matcht binnen "post".
  const hits = expect.filter((term) => {
    const esc = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^\\p{L}])${esc}([^\\p{L}]|$)`, "iu").test(text);
  });
  return { hits, total: expect.length };
}

async function run(label, body) {
  process.stdout.write(`\n=== ${label} ===\n`);
  const t0 = Date.now();
  const id = await submit(body);
  const t = await poll(id);
  const text = toText(t);
  const secs = ((Date.now() - t0) / 1000).toFixed(0);
  const diar = Array.isArray(t.utterances) && t.utterances.length > 0;
  const usedModel = t.speech_model ?? (Array.isArray(t.speech_models) ? t.speech_models.join("+") : "(default)");
  console.log(`model: ${usedModel} | taal: ${t.language_code} | speaker-labels: ${diar ? "JA" : "NEE"} | ${secs}s`);
  if (expect.length) {
    const { hits, total } = scoreExpect(text);
    console.log(`verwachte termen gevonden: ${hits.length}/${total}  [${hits.join(", ")}]`);
    const missed = expect.filter((e) => !hits.map((h) => h.toLowerCase()).includes(e.toLowerCase()));
    if (missed.length) console.log(`gemist: ${missed.join(", ")}`);
  }
  console.log("--- transcript ---");
  console.log(text.slice(0, 4000) + (text.length > 4000 ? "\n…(ingekort)" : ""));
  return text;
}

const base = { audio_url: audio, language_detection: true, speaker_labels: true };

console.log(`Audio: ${audio}`);
console.log(`Keyterms (${keyterms.length}): ${keyterms.join(", ") || "(geen)"}`);
console.log(`Verwachte termen (${expect.length}): ${expect.join(", ") || "(geen)"}`);

try {
  // A. Baseline (huidige productie)
  await run("A. Baseline (huidige productie)", baselineModel ? { ...base, speech_models: [baselineModel] } : base);
  // B. Kandidaat-model zonder keyterms
  await run(`B. ${model} (zonder keyterms)`, { ...base, speech_models: [model] });
  // C. Kandidaat-model met keyterms
  if (keyterms.length) {
    await run(`C. ${model} + keyterms`, { ...base, speech_models: [model], keyterms_prompt: keyterms });
  } else {
    console.log("\n(C overgeslagen: geen --keyterms meegegeven)");
  }
  console.log("\nKlaar. Vergelijk de 'verwachte termen gevonden'-tellingen en de leesbaarheid tussen A/B/C.");
} catch (e) {
  console.error("\nFOUT:", e.message);
  process.exit(1);
}
