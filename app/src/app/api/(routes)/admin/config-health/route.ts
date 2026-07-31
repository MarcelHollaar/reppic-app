import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { authMiddleware } from "@/app/api/middleware/authMiddleware";
import { USER_ROLE } from "@/configs/constants";
import { prisma } from "@/app/api/utils/prisma";
import { getRequestOrigin } from "@/app/api/utils/requestOrigin";
import { platformSettingsService } from "@/app/api/services/platformSettingsService";

export const dynamic = "force-dynamic";
/** Live checks against external services can take a few seconds each. */
export const maxDuration = 60;

/**
 * GET /api/admin/config-health — superadmin only.
 *
 * Runs the same checks as the repo's preflight.mjs, but ON the running
 * environment itself: open it on test or production and see immediately
 * whether this deployment can run the full pipeline
 * (opname -> transcriptie -> analyse -> dashboards).
 *
 * Advantages over the script: no shell access needed, it sees the real
 * runtime env (containers), it knows the origin it is actually served on,
 * and it can PROVE the app<->backend JWT secrets match by doing a real
 * signed call instead of comparing files.
 *
 * Never returns secret values — only presence, lengths and pass/fail.
 */

type CheckLevel = "ok" | "warn" | "fail";
interface Check {
  level: CheckLevel;
  area: string;
  name: string;
  detail: string;
}

const TIMEOUT_MS = 10_000;

async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
): Promise<{ status: number; body: string; error?: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    let body = "";
    try {
      body = await res.text();
    } catch {
      /* ignore */
    }
    return { status: res.status, body };
  } catch (e: unknown) {
    const err = e as Error;
    return {
      status: 0,
      body: "",
      error: err?.name === "AbortError" ? "timeout" : String(err?.message || e),
    };
  } finally {
    clearTimeout(timer);
  }
}

const present = (v: string | undefined | null): v is string =>
  Boolean(v && v.trim());

export async function GET(req: NextRequest) {
  const authCheck = await authMiddleware(req, USER_ROLE.SUPER_ADMIN);
  if (authCheck) return authCheck;

  const checks: Check[] = [];
  const add = (level: CheckLevel, area: string, name: string, detail: string) =>
    checks.push({ level, area, name, detail });

  // ── 1. Static env presence ─────────────────────────────────────────────────
  const requiredApp: Array<[string, string]> = [
    ["DATABASE_URL", "database"],
    ["ASSEMBLYAI_API_KEY", "transcriptie werkt niet"],
    ["LITELLM_BASE_URL", "analyse werkt niet"],
    ["LITELLM_API_KEY", "analyse werkt niet"],
    ["JWT_SECRET", "alle authenticatie faalt"],
  ];
  for (const [key, impact] of requiredApp) {
    if (present(process.env[key])) {
      add("ok", "app", key, `gezet (${process.env[key]!.trim().length} tekens)`);
    } else {
      add("fail", "app", key, `NIET GEZET — ${impact}`);
    }
  }

  for (const key of ["FTP_HOST", "FTP_USER", "FTP_PASSWORD", "FTP_PUBLIC_URL"]) {
    if (!present(process.env[key]))
      add("warn", "app", key, "niet gezet — opname-opslag/afspelen werkt niet");
  }
  for (const key of ["SMTP_HOST", "SMTP_USER", "SMTP_PASS"]) {
    if (!present(process.env[key]))
      add("warn", "app", key, "niet gezet — feedbackmails worden niet verstuurd");
  }

  // ── 2. Origin vs APP_URL ───────────────────────────────────────────────────
  // Callbacks use the live request origin since 2026-07-22, so a wrong APP_URL
  // no longer breaks the pipeline — but e-mail links still come from APP_URL.
  const origin = getRequestOrigin(req);
  const configured = process.env.APP_URL?.replace(/\/$/, "") || null;
  if (!configured) {
    add("warn", "app", "APP_URL", "niet gezet — e-mail-links vallen terug op de default");
  } else if (origin && configured !== origin) {
    add(
      "warn",
      "app",
      "APP_URL",
      `wijkt af van de live origin (${configured} vs ${origin}). Callbacks gebruiken de live origin ` +
        `en blijven werken; e-mail-links gebruiken APP_URL — controleer of die nog klopt.`,
    );
  } else {
    add("ok", "app", "APP_URL", `${configured}${origin === configured ? " (== live origin)" : ""}`);
  }

  // ── 3. Database ────────────────────────────────────────────────────────────
  try {
    await prisma.$queryRaw`SELECT 1`;
    add("ok", "database", "verbinding", "SELECT 1 geslaagd");
  } catch (e: unknown) {
    add("fail", "database", "verbinding", `query faalde: ${String((e as Error)?.message).slice(0, 150)}`);
  }

  // ── 4. LiteLLM: key + het ECHT geconfigureerde analysemodel ────────────────
  const llmBase = process.env.LITELLM_BASE_URL?.replace(/\/$/, "");
  const llmKey = process.env.LITELLM_API_KEY;
  if (llmBase && llmKey) {
    const res = await fetchWithTimeout(`${llmBase}/v1/models`, {
      headers: { Authorization: `Bearer ${llmKey}` },
    });
    if (res.status === 200) {
      let models: string[] = [];
      try {
        models = ((JSON.parse(res.body)?.data ?? []) as Array<{ id?: string }>)
          .map((m) => m.id ?? "")
          .filter(Boolean);
      } catch {
        /* ignore */
      }
      add("ok", "litellm", "API-sleutel", `geldig; ${models.length} model(len) beschikbaar`);

      // Not the env fallback but the route the analysis will actually use
      // (superadmin choice from the database included).
      try {
        const route = await platformSettingsService.getAnalysisLiteLLMRoute();
        if (models.length === 0) {
          add("warn", "litellm", `model "${route.model}"`, "modellijst leeg — kon beschikbaarheid niet verifiëren");
        } else if (models.includes(route.model)) {
          add("ok", "litellm", `analysemodel "${route.model}"`, "beschikbaar voor deze sleutel");
        } else {
          add(
            "fail",
            "litellm",
            `analysemodel "${route.model}"`,
            "NIET beschikbaar voor deze sleutel — de analyse zal met een 400 worden geweigerd. " +
              "Kies een ander model in het superadmin-scherm of laat de sleutel dit model toestaan.",
          );
        }
      } catch (e: unknown) {
        add("warn", "litellm", "analysemodel", `route kon niet worden bepaald: ${String((e as Error)?.message).slice(0, 120)}`);
      }
    } else if (res.status === 0) {
      add("fail", "litellm", "gateway", `geen verbinding met ${llmBase} (${res.error})`);
    } else {
      add("fail", "litellm", "API-sleutel", `HTTP ${res.status} — sleutel geweigerd door de gateway`);
    }
  }

  // ── 5. AssemblyAI key ──────────────────────────────────────────────────────
  if (present(process.env.ASSEMBLYAI_API_KEY)) {
    const res = await fetchWithTimeout("https://api.assemblyai.com/v2/transcript?limit=1", {
      headers: { Authorization: process.env.ASSEMBLYAI_API_KEY! },
    });
    if (res.status === 200) add("ok", "assemblyai", "API-sleutel", "geldig");
    else if (res.status === 401) add("fail", "assemblyai", "API-sleutel", "HTTP 401 — sleutel ongeldig; transcriptie werkt niet");
    else if (res.status === 0) add("warn", "assemblyai", "bereikbaarheid", `geen verbinding (${res.error})`);
    else add("warn", "assemblyai", "API-sleutel", `onverwachte HTTP ${res.status}`);
  }

  // ── 6. Dashboard-backend: bereikbaar ÉN bewijs dat JWT_SECRET matcht ───────
  const backendUrl = (
    process.env.DASHBOARD_API_URL ||
    process.env.NEXT_PUBLIC_DASHBOARD_API_URL ||
    ""
  ).replace(/\/$/, "");
  if (!backendUrl) {
    add("warn", "backend", "DASHBOARD_API_URL", "niet gezet — dashboards worden niet gevuld");
  } else if (present(process.env.JWT_SECRET)) {
    // Sign a real token with OUR secret and call the backend. 200 proves the
    // secrets match; 401 proves they differ — no file comparison needed.
    const probe = jwt.sign(
      { id: "config-health-probe", email: "probe@internal", role: "superadmin" },
      process.env.JWT_SECRET!,
      { algorithm: "HS256", expiresIn: "2m" },
    );
    const res = await fetchWithTimeout(`${backendUrl}/api/analytics/operational?lang=nl`, {
      headers: { Authorization: `Bearer ${probe}` },
    });
    if (res.status === 200) {
      add("ok", "backend", "bereikbaar + JWT-match", "app-ondertekende token geaccepteerd — secrets zijn identiek");
    } else if (res.status === 401) {
      add(
        "fail",
        "backend",
        "JWT-match",
        "backend weigert een token dat met de app-JWT_SECRET is ondertekend — de secrets VERSCHILLEN; dashboards blijven leeg",
      );
    } else if (res.status === 0) {
      add("fail", "backend", "bereikbaar", `${backendUrl} reageert niet (${res.error})`);
    } else {
      add("warn", "backend", "bereikbaar", `onverwachte HTTP ${res.status}`);
    }
  }

  // ── 7. Recall (alleen als de functie in gebruik is) ────────────────────────
  const recallKey = process.env.RECALL_API_KEY;
  const recallHook = process.env.RECALL_WEBHOOK_SECRET;
  if (recallKey || recallHook) {
    if (!present(recallHook)) {
      add(
        "fail",
        "recall",
        "RECALL_WEBHOOK_SECRET",
        "NIET GEZET — /api/webhooks/recall-sdk weigert élke callback en de desktop-opname komt nooit binnen",
      );
    } else if (!recallHook!.startsWith("whsec_")) {
      add("warn", "recall", "RECALL_WEBHOOK_SECRET", "begint niet met whsec_ — controleer of dit de Svix signing secret is");
    } else {
      add("ok", "recall", "RECALL_WEBHOOK_SECRET", `gezet (${recallHook!.length} tekens)`);
    }

    if (!present(recallKey)) {
      add("fail", "recall", "RECALL_API_KEY", "NIET GEZET — upload-token aanmaken mislukt");
    } else {
      const res = await fetchWithTimeout("https://us-west-2.recall.ai/api/v1/sdk_upload/", {
        headers: { Authorization: `Token ${recallKey}` },
      });
      if (res.status === 200) add("ok", "recall", "RECALL_API_KEY", "geldig");
      else if (res.status === 401 || res.status === 403) add("fail", "recall", "RECALL_API_KEY", `HTTP ${res.status} — sleutel geweigerd`);
      else if (res.status === 0) add("warn", "recall", "bereikbaarheid", `geen verbinding (${res.error})`);
      else add("warn", "recall", "RECALL_API_KEY", `onverwachte HTTP ${res.status}`);
    }
    if (origin) {
      add(
        "ok",
        "recall",
        "webhook-endpoint",
        `registreer in het Recall-dashboard: ${origin}/api/webhooks/recall-sdk (events sdk_upload.complete + sdk_upload.failed)`,
      );
    }
  } else {
    add("ok", "recall", "desktop-opname", "niet geconfigureerd (functie niet in gebruik) — overgeslagen");
  }

  // ── Verdict ────────────────────────────────────────────────────────────────
  const fails = checks.filter((c) => c.level === "fail");
  const warns = checks.filter((c) => c.level === "warn");

  return NextResponse.json(
    {
      healthy: fails.length === 0,
      summary:
        fails.length === 0
          ? `GEEN blokkerende problemen (${warns.length} waarschuwing(en)) — de keten kan draaien.`
          : `${fails.length} BLOKKEREND(E) probleem(en) — de keten zal NIET (volledig) werken.`,
      origin,
      checkedAt: new Date().toISOString(),
      blocking: fails,
      warnings: warns,
      passed: checks.filter((c) => c.level === "ok"),
    },
    { status: 200 },
  );
}
