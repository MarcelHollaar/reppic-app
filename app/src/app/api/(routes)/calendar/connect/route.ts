import { NextRequest, NextResponse } from "next/server";
import { authMiddleware } from "@/app/api/middleware/authMiddleware";
import {
  RecallCalendarService,
  CalendarPlatform,
  CalendarPlatformNotConfiguredError,
} from "@/app/api/services/recallCalendarService";

export const dynamic = "force-dynamic";

const VALID_PLATFORMS: CalendarPlatform[] = [
  "google_calendar",
  "microsoft_outlook",
];

/**
 * Start de agenda-OAuth-flow voor de ingelogde verkoper (per-gebruiker, elke
 * rol). Geeft de authorize-URL terug als JSON — de client redirect zelf, want
 * Bearer-auth kan niet mee in een browser-redirect. Er is geen eigen callback:
 * Recall handelt de code-exchange af en redirect naar success_url/error_url.
 */
export async function GET(req: NextRequest) {
  const authCheck = await authMiddleware(req);
  if (authCheck) return authCheck;

  const user = (req as any).user;

  const platformParam =
    req.nextUrl.searchParams.get("platform") ?? "google_calendar";
  if (!VALID_PLATFORMS.includes(platformParam as CalendarPlatform)) {
    return NextResponse.json(
      { message: "Unsupported calendar platform" },
      { status: 400 }
    );
  }
  const platform = platformParam as CalendarPlatform;

  const appBaseUrl =
    process.env.APP_URL || process.env.APP_BASE_URL || req.nextUrl.origin;

  try {
    const url = await RecallCalendarService.buildConnectUrl(
      user.id,
      platform,
      appBaseUrl
    );
    return NextResponse.json({ success: true, url });
  } catch (error) {
    if (error instanceof CalendarPlatformNotConfiguredError) {
      // Google/Microsoft-app nog niet ingesteld: nette 501 i.p.v. een crash,
      // zodat de UI "nog niet beschikbaar" kan tonen.
      return NextResponse.json(
        { message: "Calendar platform not configured", code: "not_configured" },
        { status: 501 }
      );
    }
    console.error("[Calendar] Connect failed:", error);
    return NextResponse.json(
      { message: "Calendar connect failed" },
      { status: 500 }
    );
  }
}
