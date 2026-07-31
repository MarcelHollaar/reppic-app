#!/usr/bin/env node
/**
 * Live smoketest voor de gespreksanalyse.
 *
 * Draait een voorbeeldgesprek door de ECHTE analyse-prompt (src/lib/transcript-
 * analysis/prompt.md) en de ECHTE LiteLLM-gateway (uit app/.env), en print de
 * 15 fase-scores + totaalscore + weerstanden + sfeer/klanttype. Zo zie je in één
 * oogopslag of de analyse werkt en de output klopt.
 *
 * De totaalscore gebruikt exact de verscheepte formule: gemiddelde van de 15
 * fase-scores (0/1/3) geschaald naar 0-10 = (som / 45) * 10. Weerstanden tellen
 * niet mee. (De volledige parse-/validatie-/verrijkingslogica is los unit-getest.)
 *
 * Gebruik (vanaf een naar de gateway gewhiteliste locatie):
 *   cd app
 *   node scripts/analyse-smoketest.mjs
 *
 * Vereist in app/.env: LITELLM_BASE_URL, LITELLM_API_KEY, LITELLM_MODEL.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = join(__dirname, "..");

// ── .env inlezen (geen dependency nodig) ────────────────────────────────────
function loadEnv() {
  const env = { ...process.env };
  try {
    const raw = readFileSync(join(APP_DIR, ".env"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (env[m[1]] === undefined) env[m[1]] = v;
    }
  } catch {
    /* .env optioneel als de vars al in de omgeving staan */
  }
  return env;
}

const env = loadEnv();
const BASE = env.LITELLM_BASE_URL;
const KEY = env.LITELLM_API_KEY;
const MODEL = env.LITELLM_MODEL || "twinai/medium";
const TAG = env.LITELLM_TAG || "baseline";
// Productie gebruikt DEFAULT_ANALYSIS_TEMPERATURE = 0 (niet-adaptieve route),
// tenzij LITELLM_TEMPERATURE is gezet. Zelfde default hier voor een representatieve test.
const TEMPERATURE = env.LITELLM_TEMPERATURE !== undefined && env.LITELLM_TEMPERATURE !== ""
  ? Number(env.LITELLM_TEMPERATURE)
  : 0;

if (!BASE || !KEY) {
  console.error("❌ LITELLM_BASE_URL en LITELLM_API_KEY moeten in app/.env staan.");
  process.exit(1);
}

// ── voorbeeldgesprek ────────────────────────────────────────────────────────
const TRANSCRIPT = `Jan: Goedemiddag meneer De Vries, fijn dat u tijd heeft vrijgemaakt. Hoe gaat het met u vandaag?
Klant: Goedemiddag, prima dank u. Druk maar goed.
Jan: Dat herken ik. Even over mezelf: ik ben Jan, ik werk al twaalf jaar in logistieke software en ons bedrijf helpt groothandels hun voorraad slimmer te plannen. Vandaag wil ik graag begrijpen hoe uw proces nu loopt. Ik zal een paar vragen stellen, is dat goed?
Klant: Ja, dat is goed.
Jan: Kunt u me vertellen wat uw rol is en of u betrokken bent bij de beslissing over dit soort systemen?
Klant: Ik ben operationeel directeur, dus ik beslis hierover samen met onze IT-manager.
Jan: Helder. En hoe ziet uw voorraadbeheer er nu uit? Waar loopt u tegenaan?
Klant: We werken nog veel met Excel. Het kost veel tijd en we hebben regelmatig nee-verkopen omdat de voorraad niet klopt.
Jan: Wat betekent zo'n nee-verkoop concreet voor u? Loopt u daar omzet op mis?
Klant: Zeker, we schatten een paar procent omzet, en klanten worden ontevreden.
Jan: Als u dit zou oplossen, wat zou dan het ideale plaatje zijn?
Klant: Real-time inzicht in voorraad, automatische besteladviezen, en minder handwerk.
Jan: Precies dat doen wij. Onze software geeft real-time voorraad en genereert automatisch bestelvoorstellen. Dat scheelt onze klanten gemiddeld dertig procent minder nee-verkopen. Sluit dat aan bij wat u zoekt?
Klant: Dat klinkt goed, maar jullie zijn waarschijnlijk niet goedkoop.
Jan: Dat hoor ik vaker. Waar vergelijkt u het mee? Als u de misgelopen omzet meerekent, verdient het zich vaak binnen een jaar terug.
Klant: Daar zit wat in. Stuur me maar een voorstel, dan bespreek ik het met onze IT-manager.
Jan: Doe ik. Zullen we een vervolggesprek inplannen voor volgende week donderdag, samen met uw IT-manager?
Klant: Prima, donderdag 14:00 uur kan.
Jan: Top, dan zet ik dat vast. Bedankt voor het open gesprek!`;

// ── prompt bouwen uit de echte prompt.md (zoals buildPrompt) ─────────────────
const template = readFileSync(
  join(APP_DIR, "src/lib/transcript-analysis/prompt.md"),
  "utf8",
);
const prompt = template.replaceAll("{{language}}", "nl").replace("{{gesprek}}", TRANSCRIPT);

// ── gateway-call (zelfde vorm als completeChat) ─────────────────────────────
function stripFences(s) {
  return s.trim().replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/, "");
}

async function main() {
  console.log(`\n🌐 Analyse via ${BASE} (model ${MODEL}, tag ${TAG})…\n`);
  const t0 = Date.now();
  const res = await fetch(`${BASE}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: TEMPERATURE,
      max_tokens: 16000,
      response_format: { type: "json_object" },
      metadata: { tags: [TAG] },
    }),
  });

  const text = await res.text();
  if (!res.ok) {
    console.error(`❌ Gateway HTTP ${res.status}:\n${text.slice(0, 400)}`);
    if (res.status === 403) console.error("\n(403 = IP-blokkade — draai dit vanaf een gewhiteliste locatie.)");
    process.exit(1);
  }

  let body;
  try { body = JSON.parse(text); } catch { console.error("❌ Gateway-antwoord is geen JSON:\n" + text.slice(0, 400)); process.exit(1); }
  const content = body?.choices?.[0]?.message?.content;
  if (!content) { console.error("❌ Lege completion:\n" + JSON.stringify(body).slice(0, 400)); process.exit(1); }

  let data;
  try { data = JSON.parse(stripFences(content)); }
  catch { console.error("❌ Model-output is geen geldige JSON:\n" + content.slice(0, 500)); process.exit(1); }

  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  const fases = Array.isArray(data.Fases) ? data.Fases : [];
  const som = fases.reduce((s, f) => s + (Number(f?.Score) || 0), 0);
  const totaalscore = data.GeenSalesgesprek ? 0 : parseFloat(Math.max(0, Math.min(10, (som / 45) * 10)).toFixed(1));

  console.log(`⏱️  ${secs}s\n`);
  console.log("Sfeer            :", data.Sfeer);
  console.log("Klanttype        :", data.Klanttype);
  console.log("GeenSalesgesprek :", data.GeenSalesgesprek === true);
  console.log("\n── Fase-scores (0/1/3) ──");
  for (const f of fases) console.log(`  ${String(f?.Score).padStart(1)}  ${f?.Titel}`);
  console.log(`  som = ${som}/45  →  Totaalscore = ${totaalscore}`);
  console.log("\n── Weerstanden ──");
  (Array.isArray(data.Weerstanden) ? data.Weerstanden : []).forEach((w) =>
    console.log(`  [${w?.Conclusie}] "${String(w?.KlantWeerstand || "").slice(0, 60)}"`),
  );
  console.log("\n── Leerpunten ──");
  (Array.isArray(data.Leerpunten) ? data.Leerpunten : []).forEach((l) => console.log("  •", l));
  console.log("\nSamenvatting:", String(data.Samenvatting || "").slice(0, 220), "…");

  // sanity
  const problems = [];
  if (fases.length !== 15) problems.push(`aantal fases = ${fases.length} (verwacht 15)`);
  if (!(totaalscore >= 0 && totaalscore <= 10)) problems.push(`totaalscore buiten 0-10`);
  if (!data.Sfeer) problems.push("Sfeer ontbreekt");
  console.log(problems.length ? `\n⚠️  ${problems.join("; ")}` : "\n✅ Output ziet er compleet uit (15 fases, geldige score, velden aanwezig).");
}

main().catch((e) => { console.error("\n❌ FOUT:", e.message); process.exit(1); });
