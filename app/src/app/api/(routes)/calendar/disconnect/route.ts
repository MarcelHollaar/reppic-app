import { NextRequest, NextResponse } from "next/server";
import { authMiddleware } from "@/app/api/middleware/authMiddleware";
import {
  RecallCalendarService,
  CalendarPlatform,
} from "@/app/api/services/recallCalendarService";

export const dynamic = "force-dynamic";

const VALID_PLATFORMS: CalendarPlatform[] = [
  "google_calendar",
  "microsoft_outlook",
];

/**
 * Ontkoppelt de agenda van de ingelogde verkoper. Zonder platform in de body
 * ontkoppelen we de eerste actieve verbinding.
 */
export async function POST(req: NextRequest) {
  const authCheck = await authMiddleware(req);
  if (authCheck) return authCheck;

  const user = (req as any).user;

  try {
    let platform: CalendarPlatform | null = null;
    try {
      const body = await req.json();
      if (body?.platform && VALID_PLATFORMS.includes(body.platform)) {
        platform = body.platform;
      }
    } catch {
      // lege/ongeldige body → platform uit de live status halen
    }

    if (!platform) {
      const status = await RecallCalendarService.getConnectionStatus(user.id);
      if (
        status.platform &&
        VALID_PLATFORMS.includes(status.platform as CalendarPlatform)
      ) {
        platform = status.platform as CalendarPlatform;
      }
    }

    if (!platform) {
      return NextResponse.json({ success: true, alreadyDisconnected: true });
    }

    await RecallCalendarService.disconnectPlatform(user.id, platform);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Calendar] Disconnect failed:", error);
    return NextResponse.json({ message: "Disconnect failed" }, { status: 500 });
  }
}
