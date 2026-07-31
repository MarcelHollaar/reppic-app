import { NextRequest, NextResponse } from "next/server";
import { authMiddleware } from "@/app/api/middleware/authMiddleware";
import { prisma } from "@/app/api/utils/prisma";
import { USER_ROLE } from "@/configs/constants";

/**
 * Superadmin-only: list companies for the terminology-glossary picker.
 * Returns whether each company already has a saved glossary so the UI can
 * mark it.
 */
export async function GET(req: NextRequest) {
  const authCheck = await authMiddleware(req);
  if (authCheck) return authCheck;

  const requester = (req as any).user;
  if (requester?.role?.name !== USER_ROLE.SUPER_ADMIN) {
    return NextResponse.json(
      { error: "Unauthorized: Insufficient permissions" },
      { status: 403 },
    );
  }

  try {
    const [companies, terminologies] = await Promise.all([
      prisma.company.findMany({
        select: { id: true, title: true },
        orderBy: { title: "asc" },
      }),
      prisma.companyTerminology.findMany({
        select: { company_id: true },
      }),
    ]);

    const withGlossary = new Set(terminologies.map((t) => t.company_id));

    return NextResponse.json({
      companies: companies.map((c) => ({
        id: c.id,
        title: c.title,
        hasGlossary: withGlossary.has(c.id),
      })),
    });
  } catch (error) {
    console.error("[terminology] Failed to list companies:", error);
    return NextResponse.json(
      { error: "Kon bedrijven niet laden" },
      { status: 500 },
    );
  }
}
