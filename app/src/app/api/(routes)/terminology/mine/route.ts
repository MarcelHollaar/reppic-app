import { NextRequest, NextResponse } from "next/server";
import { authMiddleware } from "@/app/api/middleware/authMiddleware";
import { prisma } from "@/app/api/utils/prisma";
import { getCompanyTerminology } from "@/app/api/services/terminologyService";

/**
 * Returns the terminology glossary for the LOGGED-IN user's own company, so the
 * dashboard tiles can overlay the company's terms on the standard PICA labels.
 * Any authenticated user may read their own company's glossary; returns {} when
 * there is none.
 */
export async function GET(req: NextRequest) {
  const authCheck = await authMiddleware(req);
  if (authCheck) return authCheck;

  const requester = (req as any).user;

  try {
    // The middleware user shape varies; resolve company_id from the DB by id.
    let companyId: string | null = requester?.company_id ?? null;
    if (!companyId && requester?.id) {
      const user = await prisma.user.findUnique({
        where: { id: requester.id },
        select: { company_id: true },
      });
      companyId = user?.company_id ?? null;
    }

    const mapping = await getCompanyTerminology(companyId);
    return NextResponse.json({ mapping });
  } catch (error) {
    console.error("[terminology] Failed to load own glossary:", error);
    // Non-fatal for the dashboard — return empty so tiles fall back to standard.
    return NextResponse.json({ mapping: {} });
  }
}
