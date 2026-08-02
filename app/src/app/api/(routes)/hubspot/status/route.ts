import { NextRequest, NextResponse } from "next/server";
import { authMiddleware } from "@/app/api/middleware/authMiddleware";
import { HubspotService } from "@/app/api/services/hubspotService";

export const dynamic = "force-dynamic";

/** Verbindingsstatus van de HubSpot-koppeling van de eigen tenant. */
export async function GET(req: NextRequest) {
  const authCheck = await authMiddleware(req);
  if (authCheck) return authCheck;

  const user = (req as any).user;
  if (!user?.company_id) {
    return NextResponse.json({ connected: false });
  }

  try {
    const status = await HubspotService.getConnectionStatus(user.company_id);
    return NextResponse.json(status);
  } catch (error) {
    console.error("[HubSpot] Status lookup failed:", error);
    return NextResponse.json(
      { message: "Status lookup failed" },
      { status: 500 }
    );
  }
}
