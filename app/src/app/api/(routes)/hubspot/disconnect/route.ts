import { NextRequest, NextResponse } from "next/server";
import { authMiddleware } from "@/app/api/middleware/authMiddleware";
import { HubspotService } from "@/app/api/services/hubspotService";
import { USER_ROLE } from "@/configs/constants";

export const dynamic = "force-dynamic";

/** Ontkoppelt de HubSpot-verbinding van de eigen tenant. */
export async function POST(req: NextRequest) {
  const authCheck = await authMiddleware(req, USER_ROLE.MANAGER, true);
  if (authCheck) return authCheck;

  const user = (req as any).user;
  if (!user?.company_id) {
    return NextResponse.json(
      { message: "User has no company" },
      { status: 400 }
    );
  }

  try {
    await HubspotService.disconnect(user.company_id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[HubSpot] Disconnect failed:", error);
    return NextResponse.json(
      { message: "Disconnect failed" },
      { status: 500 }
    );
  }
}
