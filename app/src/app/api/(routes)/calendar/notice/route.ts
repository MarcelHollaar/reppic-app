import { NextRequest, NextResponse } from "next/server";
import { authMiddleware } from "@/app/api/middleware/authMiddleware";
import { prisma } from "@/app/api/utils/prisma";
import { PLATFORM_SETTING_KEYS } from "@/configs/constants";

export const dynamic = "force-dynamic";

/**
 * Schakelbare disclaimer voor de agenda-koppeling (pilot/validatiefase).
 * Leest de tekst uit de platform-instelling `calendar_pilot_notice`. Leeg of
 * afwezig ⇒ lege string ⇒ de UI toont niets. De developer kan de tekst
 * aanpassen of leegmaken via die DB-rij — ZONDER nieuwe deploy.
 */
export async function GET(req: NextRequest) {
  const authCheck = await authMiddleware(req);
  if (authCheck) return authCheck;

  try {
    const setting = await prisma.platformSetting.findUnique({
      where: { key: PLATFORM_SETTING_KEYS.CALENDAR_PILOT_NOTICE },
    });
    return NextResponse.json({ notice: setting?.value?.trim() ?? "" });
  } catch (error) {
    console.error("[Calendar] Notice lookup failed:", error);
    // Nooit de instellingenpagina laten breken op deze niet-kritieke tekst.
    return NextResponse.json({ notice: "" });
  }
}
