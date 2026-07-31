#!/usr/bin/env node
/**
 * Reppic deployment preflight
 * ---------------------------
 * Verifies that an environment is actually able to run the full pipeline
 * (opname -> transcriptie -> analyse -> dashboards) BEFORE you rely on it.
 *
 * Run from the repo root:            node preflight.mjs
 * Only check config, no live calls:  node preflight.mjs --offline
 *
 * Reads values from app/.env and dashboard-backend/.env when present, but real
 * environment variables always win (containers often have no .env file).
 * Secrets are never printed — only lengths and pass/fail.
 *
 * Exit code 0 = safe to use, 1 = at least one blocking problem.
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const OFFLINE = process.argv.includes("--offline");
const TIMEOUT_MS = 15000;

// ── env loading ─────────────────────────────────────────────────────────────

function parseEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const raw of readFileSync(path, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

const appFile = parseEnvFile(join(ROOT, "app", ".env"));
const beFile = parseEnvFile(join(ROOT, "dashboard-backend", ".env"));

/** Real env wins over the file (containers inject env directly). */
const app = (k) => (process.env[k] ?? appFile[k] ?? "").trim();
const be = (k) => (process.env[k] ?? beFile[k] ?? "").trim();

// ── result collection ───────────────────────────────────────────────────────

const results = [];
const add = (level, area, label, detail) =>
  results.push({ level, area, label, detail });
const ok = (area, label, detail) => add("OK", area, label, detail);
const warn = (area, label, detail) => add("WARN", area, label, detail);
const fail = (area, label, detail) => add("FAIL", area, label, detail);

const mask = (v) => (v ? `gezet (${v.length} tekens)` : "LEEG");

async function httpGet(url, headers = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers, signal: ctrl.signal });
    let body = "";
    try {
      body = await res.text();
    } catch {
      /* ignore */
    }
    return { status: res.status, body };
  } catch (e) {
    return { status: 0, body: "", error: e?.name === "AbortError" ? "timeout" : String(e?.message || e) };
  } finally {
    clearTimeout(timer);
  }
}

// ── 1. required config ──────────────────────────────────────────────────────

function checkRequired() {
  // Rollback 2026-07-22: de webhook-authenticatie is verwijderd, dus deze
  // variabele is NIET meer nodig en blokkeert niets. Wel melden zodat niemand
  // denkt dat het endpoint nog beveiligd is.
  if (app("ASSEMBLYAI_WEBHOOK_SECRET")) {
    warn(
      "app",
      "ASSEMBLYAI_WEBHOOK_SECRET",
      "gezet maar wordt NIET meer gebruikt (webhook-authenticatie is teruggedraaid); mag weg",
    );
  } else {
    ok("app", "ASSEMBLYAI_WEBHOOK_SECRET", "niet nodig (webhook-authenticatie is teruggedraaid)");
  }

  for (const k of ["DATABASE_URL", "ASSEMBLYAI_API_KEY", "LITELLM_BASE_URL", "LITELLM_API_KEY"]) {
    const v = app(k);
    if (!v) fail("app", k, "NIET GEZET");
    else ok("app", k, k.endsWith("URL") ? v : mask(v));
  }

  // Sinds 2026-07-22 worden webhook-callbacks afgeleid van de live
  // request-origin — een verkeerde APP_URL breekt de pijplijn dus niet meer.
  // APP_URL wordt nog wel gebruikt voor e-mail-links.
  const appUrl = app("APP_URL");
  if (!appUrl) {
    warn("app", "APP_URL", "niet gezet -> e-mail-links vallen terug op de default (callbacks werken wel)");
  } else if (/localhost|127\.0\.0\.1/.test(appUrl)) {
    warn(
      "app",
      "APP_URL",
      `${appUrl} -> e-mail-links wijzen naar localhost; callbacks werken wel (live origin)`,
    );
  } else {
    ok("app", "APP_URL", `${appUrl} (alleen voor e-mail-links; callbacks gebruiken de live origin)`);
  }

  // JWT must exist AND match the backend, otherwise dashboards come back empty.
  const aj = app("JWT_SECRET");
  const bj = be("JWT_SECRET");
  if (!aj) fail("app", "JWT_SECRET", "NIET GEZET -> alle authenticatie faalt");
  else if (aj.length < 32) warn("app", "JWT_SECRET", `zwak (${aj.length} tekens); gebruik openssl rand -hex 32`);
  else ok("app", "JWT_SECRET", mask(aj));

  if (!bj) {
    fail("backend", "JWT_SECRET", "NIET GEZET in dashboard-backend");
  } else if (aj && bj && aj !== bj) {
    fail(
      "backend",
      "JWT_SECRET",
      "WIJKT AF van app/JWT_SECRET -> de app mag niet bij de backend; dashboards blijven leeg",
    );
  } else if (aj && bj) {
    ok("backend", "JWT_SECRET", "identiek aan app");
  }

  if (!be("SESSION_SECRET")) warn("backend", "SESSION_SECRET", "niet gezet");
  else ok("backend", "SESSION_SECRET", mask(be("SESSION_SECRET")));

  if (!be("DATABASE_URL")) fail("backend", "DATABASE_URL", "NIET GEZET");
  else ok("backend", "DATABASE_URL", "gezet");

  // Nice-to-have but the pipeline degrades without them.
  for (const k of ["FTP_HOST", "FTP_USER", "FTP_PASSWORD", "FTP_PUBLIC_URL"]) {
    if (!app(k)) warn("app", k, "niet gezet -> opname-opslag/afspelen werkt niet");
  }
  for (const k of ["SMTP_HOST", "SMTP_USER", "SMTP_PASS"]) {
    if (!app(k)) warn("app", k, "niet gezet -> feedbackmails worden niet verstuurd");
  }
}

// ── 2. live checks ──────────────────────────────────────────────────────────

async function checkLiteLLM() {
  const base = app("LITELLM_BASE_URL").replace(/\/$/, "");
  const key = app("LITELLM_API_KEY");
  if (!base || !key) return;

  const res = await httpGet(`${base}/v1/models`, { Authorization: `Bearer ${key}` });

  if (res.status === 0) {
    fail("litellm", "gateway bereikbaar", `geen verbinding met ${base} (${res.error})`);
    return;
  }
  if (res.status === 401 || res.status === 403) {
    fail("litellm", "API-sleutel", `HTTP ${res.status} -> de LITELLM_API_KEY wordt geweigerd door de gateway`);
    return;
  }
  if (res.status === 400) {
    fail(
      "litellm",
      "API-sleutel",
      `HTTP 400 van de auth-laag -> sleutel ongeldig, verlopen, of geen rechten. Antwoord: ${res.body.slice(0, 200)}`,
    );
    return;
  }
  if (res.status !== 200) {
    fail("litellm", "API-sleutel", `onverwachte HTTP ${res.status}: ${res.body.slice(0, 200)}`);
    return;
  }

  let models = [];
  try {
    const parsed = JSON.parse(res.body);
    models = (parsed?.data ?? []).map((m) => m.id).filter(Boolean);
  } catch {
    /* ignore */
  }
  ok("litellm", "API-sleutel", `geldig; ${models.length} model(len) beschikbaar`);

  // The analysis falls back to LITELLM_MODEL when no superadmin choice is
  // stored. A model the key may not use is exactly what produces a 400.
  const configured = app("LITELLM_MODEL") || "twinai/medium";
  if (models.length === 0) {
    warn("litellm", "modellijst", "kon de lijst niet lezen; controleer het model handmatig");
    return;
  }
  if (models.includes(configured)) {
    ok(
      "litellm",
      `model "${configured}"`,
      "beschikbaar voor deze sleutel (let op: een door de superadmin gekozen ander model moet er ook in staan)",
    );
    return;
  }
  // Only dump names when something is actually wrong, and keep it readable:
  // prefer the analysis-relevant families over the full multi-hundred list.
  const relevant = models.filter((m) => /^(twinai|anthropic|openai)\//.test(m));
  const sample = (relevant.length ? relevant : models).slice(0, 20);
  fail(
    "litellm",
    `model "${configured}"`,
    `NIET beschikbaar voor deze sleutel. Voorbeelden die wel mogen: ${sample.join(", ")}` +
      `${(relevant.length || models.length) > sample.length ? " …" : ""}`,
  );
}

/**
 * Desktop Recording SDK (Recall.ai). Only blocking when the feature is in use —
 * detected by the presence of RECALL_API_KEY.
 */
async function checkRecall() {
  const key = app("RECALL_API_KEY");
  const hookSecret = app("RECALL_WEBHOOK_SECRET");

  if (!key && !hookSecret) {
    ok("recall", "desktop-opname", "niet geconfigureerd (functie niet in gebruik) — overgeslagen");
    return;
  }

  // Fail-closed, exactly like the AssemblyAI webhook was: without this secret
  // /api/webhooks/recall-sdk rejects EVERY call and the recording silently
  // never lands in the app.
  if (!hookSecret) {
    fail(
      "recall",
      "RECALL_WEBHOOK_SECRET",
      "NIET GEZET -> /api/webhooks/recall-sdk weigert élke callback (401) en de opname komt NOOIT binnen, " +
        "zonder foutmelding. Haal de signing secret (whsec_...) op bij het webhook-endpoint in het Recall-dashboard.",
    );
  } else if (!hookSecret.startsWith("whsec_")) {
    warn(
      "recall",
      "RECALL_WEBHOOK_SECRET",
      `begint niet met "whsec_" (${hookSecret.length} tekens) — controleer of dit de Svix signing secret is`,
    );
  } else {
    ok("recall", "RECALL_WEBHOOK_SECRET", mask(hookSecret));
  }

  if (!key) {
    fail("recall", "RECALL_API_KEY", "NIET GEZET -> upload-token aanmaken mislukt, opnemen start niet");
    return;
  }

  // Live check against the same base URL + auth scheme the app uses.
  const res = await httpGet("https://us-west-2.recall.ai/api/v1/sdk_upload/", {
    Authorization: `Token ${key}`,
  });
  if (res.status === 200) ok("recall", "RECALL_API_KEY", "geldig");
  else if (res.status === 401 || res.status === 403)
    fail("recall", "RECALL_API_KEY", `HTTP ${res.status} -> sleutel geweigerd door Recall.ai`);
  else if (res.status === 0) warn("recall", "bereikbaarheid", `geen verbinding met Recall.ai (${res.error})`);
  else warn("recall", "RECALL_API_KEY", `onverwachte HTTP ${res.status}: ${res.body.slice(0, 150)}`);

  const appUrl = app("APP_URL");
  if (appUrl && !/localhost|127\.0\.0\.1/.test(appUrl)) {
    console.log(
      `\n    Registreer in het Recall-dashboard een webhook-endpoint op:\n` +
        `      ${appUrl.replace(/\/$/, "")}/api/webhooks/recall-sdk\n` +
        `    met de events sdk_upload.complete en sdk_upload.failed.\n` +
        `    De signing secret van DAT endpoint is de waarde van RECALL_WEBHOOK_SECRET.\n` +
        `    Let op: schermopname werkt alleen in de desktop-app, niet in een browser.`,
    );
  }
}

async function checkAssemblyAI() {
  const key = app("ASSEMBLYAI_API_KEY");
  if (!key) return;
  const res = await httpGet("https://api.assemblyai.com/v2/transcript?limit=1", { Authorization: key });
  if (res.status === 200) ok("assemblyai", "API-sleutel", "geldig");
  else if (res.status === 401) fail("assemblyai", "API-sleutel", "HTTP 401 -> sleutel ongeldig; transcriptie werkt niet");
  else if (res.status === 0) warn("assemblyai", "bereikbaarheid", `geen verbinding (${res.error})`);
  else warn("assemblyai", "API-sleutel", `HTTP ${res.status}`);
}

async function checkAppUrl() {
  const url = app("APP_URL");
  if (!url || /localhost|127\.0\.0\.1/.test(url)) return;
  const res = await httpGet(url.replace(/\/$/, ""));
  if (res.status === 0) {
    warn(
      "app",
      "APP_URL bereikbaar",
      `${url} reageert niet (${res.error}) -> e-mail-links wijzen naar een dode URL (callbacks werken wel: live origin)`,
    );
  } else {
    ok("app", "APP_URL bereikbaar", `HTTP ${res.status}`);
  }
}

async function checkDashboardBackend() {
  const url = (app("DASHBOARD_API_URL") || app("NEXT_PUBLIC_DASHBOARD_API_URL")).replace(/\/$/, "");
  if (!url) {
    warn("backend", "DASHBOARD_API_URL", "niet gezet -> app kan dashboards niet vullen");
    return;
  }
  const res = await httpGet(`${url}/api/analytics/operational`);
  if (res.status === 0) fail("backend", "bereikbaar", `${url} reageert niet (${res.error})`);
  else ok("backend", "bereikbaar", `HTTP ${res.status} (401 is prima: server leeft)`);
}

// ── run ─────────────────────────────────────────────────────────────────────

console.log("\nReppic preflight — controleert of deze omgeving de volledige keten aankan\n");
if (!existsSync(join(ROOT, "app"))) {
  console.error("Draai dit script vanuit de hoofdmap van het project (waar app/ en dashboard-backend/ staan).");
  process.exit(1);
}

checkRequired();
if (!OFFLINE) {
  await checkLiteLLM();
  await checkAssemblyAI();
  await checkRecall();
  await checkAppUrl();
  await checkDashboardBackend();
} else {
  console.log("(--offline: externe controles overgeslagen)\n");
}

const icon = { OK: "✓", WARN: "!", FAIL: "✗" };
// Group by area so each section is printed once, in a stable order, with the
// problems first inside each section.
const AREA_ORDER = ["app", "backend", "litellm", "assemblyai", "recall"];
const rank = { FAIL: 0, WARN: 1, OK: 2 };
const areas = [...new Set(results.map((r) => r.area))].sort(
  (a, b) => (AREA_ORDER.indexOf(a) + 1 || 99) - (AREA_ORDER.indexOf(b) + 1 || 99),
);
for (const a of areas) {
  console.log(`\n[${a}]`);
  for (const r of results.filter((x) => x.area === a).sort((x, y) => rank[x.level] - rank[y.level])) {
    console.log(`  ${icon[r.level]} ${r.label}: ${r.detail}`);
  }
}

const fails = results.filter((r) => r.level === "FAIL");
const warns = results.filter((r) => r.level === "WARN");

console.log("\n" + "-".repeat(70));
if (fails.length === 0) {
  console.log(`GEEN BLOKKERENDE PROBLEMEN (${warns.length} waarschuwing(en)).`);
  console.log("De keten opname -> transcriptie -> analyse -> dashboards kan draaien.\n");
  process.exit(0);
}
console.log(`${fails.length} BLOKKEREND PROBLEEM(EN) — de analyse zal NIET (volledig) werken:\n`);
for (const f of fails) console.log(`  ✗ [${f.area}] ${f.label}\n      ${f.detail}\n`);
console.log("Los deze op, HERSTART de service, en draai dit script opnieuw.\n");
process.exit(1);
