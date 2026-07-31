import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/api/utils/prisma";
import { rateLimit, getClientIp } from "@/app/api/utils/rateLimiter";

export const dynamic = "force-dynamic";

/**
 * GET /api/health — public liveness/readiness probe for external monitoring.
 *
 * Deliberately dumb and closed: no input is read (no query params, no body),
 * nothing is written, and the response never contains configuration, versions
 * or error details — only "up or not" and "database reachable or not". The
 * sensitive, detailed check remains the superadmin-only
 * /api/admin/config-health.
 */

// Cache the DB probe briefly so aggressive polling never hammers the database.
const DB_PROBE_CACHE_MS = 5_000;
let lastProbeAt = 0;
let lastProbeOk = false;

async function probeDatabase(): Promise<boolean> {
  const now = Date.now();
  if (now - lastProbeAt < DB_PROBE_CACHE_MS) return lastProbeOk;

  try {
    await prisma.$queryRaw`SELECT 1`;
    lastProbeOk = true;
  } catch {
    // Never leak the underlying error; the boolean is all a monitor needs.
    lastProbeOk = false;
  }
  lastProbeAt = now;
  return lastProbeOk;
}

export async function GET(req: NextRequest) {
  // Generous per-IP cap: real monitors poll about once a minute; this only
  // blunts abuse. 429 also tells the monitor "alive but throttled".
  const limit = rateLimit(`health:${getClientIp(req)}`, 30, 60_000);
  if (!limit.allowed) {
    return NextResponse.json({ status: "throttled" }, { status: 429 });
  }

  const dbOk = await probeDatabase();

  return NextResponse.json(
    {
      status: dbOk ? "ok" : "degraded",
      db: dbOk ? "ok" : "error",
      time: new Date().toISOString(),
    },
    { status: dbOk ? 200 : 503 },
  );
}
