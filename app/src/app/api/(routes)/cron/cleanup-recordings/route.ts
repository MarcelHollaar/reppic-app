import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { runRecordingCleanup } from "../../../services/recordingCleanupService";

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

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { message: "CRON_SECRET is not configured" },
      { status: 503 },
    );
  }

  const { searchParams } = new URL(req.url);
  const dryRun = searchParams.get("dryRun") === "true";

  try {
    console.log(`[RecordingCleanup] Cron started (dryRun=${dryRun})`);

    const result = await runRecordingCleanup({ dryRun });

    console.log("[RecordingCleanup] Cron finished:", result);

    return NextResponse.json(result, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Cleanup failed";

    console.error("[RecordingCleanup] Cron error:", error);

    return NextResponse.json({ message }, { status: 500 });
  }
}
