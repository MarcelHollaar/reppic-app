import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { runMonthlyManagerReports } from "../../../services/report/monthlyManagerReportService";

export const dynamic = "force-dynamic";

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;
  // Constant-time comparison to avoid a token-guessing timing side channel.
  return safeEqual(authHeader.slice(7), cronSecret);
}

/** Eerste maandag van de maand: het is maandag én dagnummer ≤ 7. */
function isFirstMonday(d: Date): boolean {
  return d.getDay() === 1 && d.getDate() <= 7;
}

/**
 * Maandelijks manager-rapport. De cron-container draait dit ELKE maandag
 * (cron kan "eerste maandag" niet uitdrukken); deze route stopt vroeg tenzij
 * het de eerste maandag van de maand is. Query-params:
 *   ?force=true  — guard overslaan (handmatig testen)
 *   ?dryRun=true — alles bepalen en loggen, niets versturen
 */
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const dryRun = searchParams.get("dryRun") === "true";
  const force = searchParams.get("force") === "true";

  const now = new Date();
  if (!force && !isFirstMonday(now)) {
    return NextResponse.json(
      { message: "Niet de eerste maandag van de maand — niets te doen" },
      { status: 200 },
    );
  }

  try {
    console.log(
      `[MonthlyReport] Cron gestart (dryRun=${dryRun}, force=${force})`,
    );
    const result = await runMonthlyManagerReports({ dryRun, now });
    console.log(
      `[MonthlyReport] Klaar: ${result.companies
        .map((c) => `${c.companyTitle}=${c.status}(${c.recipients.length})`)
        .join(", ")}`,
    );
    return NextResponse.json(result, { status: 200 });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Monthly report run failed";
    console.error("[MonthlyReport] Cron error:", error);
    return NextResponse.json({ message }, { status: 500 });
  }
}
