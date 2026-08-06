import { NextRequest, NextResponse } from "next/server";
import { authMiddleware } from "@/app/api/middleware/authMiddleware";
import { RecallCalendarService } from "@/app/api/services/recallCalendarService";

export const dynamic = "force-dynamic";

/** Live koppelstatus van de agenda van de ingelogde verkoper (via Recall). */
export async function GET(req: NextRequest) {
  const authCheck = await authMiddleware(req);
  if (authCheck) return authCheck;

  const user = (req as any).user;

  try {
    const status = await RecallCalendarService.getConnectionStatus(user.id);
    return NextResponse.json(status);
  } catch (error) {
    // Recall onbereikbaar of geen calendar-user: behandel als "niet gekoppeld"
    // i.p.v. een 500 — de instellingenpagina moet altijd kunnen laden.
    console.error("[Calendar] Status lookup failed:", error);
    return NextResponse.json({
      connected: false,
      platform: null,
      email: null,
    });
  }
}
