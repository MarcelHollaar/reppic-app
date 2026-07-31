#!/usr/bin/env node
/**
 * Verifieert dat een NIET-salesgesprek (monoloog) nu tóch een follow-up Mail
 * oplevert, met de aangepaste prompt.md. Draait de echte prompt door de
 * LiteLLM-gateway (uit app/.env). Pin het model met LITELLM_TAG (default openai).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  const env = { ...process.env };
  try {
    for (const line of readFileSync(join(APP_DIR, ".env"), "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (env[m[1]] === undefined) env[m[1]] = v;
    }
  } catch {}
  return env;
}

const env = loadEnv();
const BASE = env.LITELLM_BASE_URL;
const KEY = env.LITELLM_API_KEY;
const MODEL = env.LITELLM_MODEL || "twinai/medium";
const TAG = process.env.LITELLM_TAG_OVERRIDE || "openai"; // pin gpt-5-mini

// NIET-salesgesprek dat WEL een echte conversatie is: een interne projectvergadering.
const TRANSCRIPT = `Jan: Oké, laten we beginnen met de projectstand van Reppic. Lisa, hoe staat het met de dashboardmodule?
Lisa: De strategische dashboards zijn af, en de vertalingen liepen eerst achter maar die zijn nu ook klaar in alle zes talen.
Jan: Mooi. En de desktop-opname, Piet?
Piet: De testopstelling werkt end-to-end. Enige aandachtspunt is de audiopermissie op de Mac, maar in productie via ToDesktop lost dat zich op.
Jan: Duidelijk. Dan spreken we af dat Piet volgende week een ToDesktop-account opzet, en Lisa doet de laatste vertaalcheck. Lisa, kun jij ook de release-notes voorbereiden?
Lisa: Ja, die lever ik uiterlijk vrijdag op.
Jan: Top. Besluit: we mikken op een testrelease volgende week donderdag. Nog vragen? Nee? Dan sluiten we af, bedankt allemaal.`;

function stripFences(s) {
  return s.trim().replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/, "");
}

async function main() {
  const template = readFileSync(join(APP_DIR, "src/lib/transcript-analysis/prompt.md"), "utf8");
  const prompt = template.replaceAll("{{language}}", "nl").replace("{{gesprek}}", TRANSCRIPT);

  console.log(`\n🌐 Niet-sales verificatie via ${BASE} (model ${MODEL}, tag ${TAG})…\n`);
  const res = await fetch(`${BASE}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
      max_tokens: 16000,
      response_format: { type: "json_object" },
      metadata: { tags: [TAG] },
    }),
  });
  const text = await res.text();
  if (!res.ok) { console.error(`❌ Gateway HTTP ${res.status}: ${text.slice(0, 300)}`); process.exit(1); }
  const content = JSON.parse(text)?.choices?.[0]?.message?.content;
  const data = JSON.parse(stripFences(content));

  const mail = String(data.Mail || "");
  const samenvatting = String(data.Samenvatting || "");

  console.log("GeenSalesgesprek :", data.GeenSalesgesprek === true);
  console.log("Totaalscore      :", data.GeenSalesgesprek ? 0 : "(sales)");
  console.log("\n── Samenvatting (verslag) ──\n" + samenvatting.slice(0, 300));
  console.log("\n── Mail (follow-up) ──\n" + (mail || "‹LEEG›"));

  console.log("\n════ CONTROLES ════");
  const ok = (l, c) => console.log(`  ${c ? "✅" : "❌"} ${l}`);
  ok("Herkend als GeenSalesgesprek (verwacht)", data.GeenSalesgesprek === true);
  ok("Samenvatting/verslag aanwezig", samenvatting.length > 20);
  ok("Mail is NIET leeg (de fix)", mail.trim().length > 0);
  console.log(mail.trim().length > 0
    ? "\n🎉 De verkoper krijgt nu een follow-up mail, ook bij een niet-salesgesprek."
    : "\n⚠️  Mail is nog leeg — prompt-wijziging niet effectief.");
  process.exit(mail.trim().length > 0 ? 0 : 1);
}
main().catch((e) => { console.error("❌ FOUT:", e.message); process.exit(1); });
