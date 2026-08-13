import { NextRequest, NextResponse } from "next/server";
import { authMiddleware } from "@/app/api/middleware/authMiddleware";
import {
  getCrmConnectionStatus,
  listCrmProviders,
} from "@/app/api/services/crm/registry";

export const dynamic = "force-dynamic";

/**
 * Status van de CRM-koppeling van de eigen tenant + welke providers
 * geconfigureerd (dus koppelbaar) zijn. De UI toont per provider een knop en
 * disablet de nog niet ingestelde providers.
 */
export async function GET(req: NextRequest) {
  const authCheck = await authMiddleware(req);
  if (authCheck) return authCheck;

  const user = (req as any).user;
  if (!user?.company_id) {
    return NextResponse.json({ connected: false, providers: [] });
  }

  try {
    const status = await getCrmConnectionStatus(user.company_id);
    return NextResponse.json({ ...status, providers: listCrmProviders() });
  } catch (error) {
    console.error("[CRM] Status lookup failed:", error);
    return NextResponse.json({ message: "Status lookup failed" }, { status: 500 });
  }
}
