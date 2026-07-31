import { NextRequest, NextResponse } from "next/server";
import { authMiddleware } from "@/app/api/middleware/authMiddleware";
import { USER_ROLE } from "@/configs/constants";
import { prisma } from "@/app/api/utils/prisma";
import {
  getCompanyTerminology,
  setCompanyTerminology,
} from "@/app/api/services/terminologyService";
import {
  TERMINOLOGY_PHASES,
  TERMINOLOGY_TOPICS,
} from "@/lib/transcript-analysis/terminologyConcepts";

/**
 * Superadmin-only management of a company's terminology glossary.
 *
 * GET  ?companyId=… → the canonical concepts (phases + topics) plus the saved
 *                     company terms, so the UI can render an editable table.
 * PUT  { companyId, mapping } → upsert the glossary (unknown keys / empty terms
 *                     are dropped server-side by the service).
 */

function requireSuperadmin(req: NextRequest) {
  const requester = (req as any).user;
  if (requester?.role?.name !== USER_ROLE.SUPER_ADMIN) {
    return NextResponse.json(
      { error: "Unauthorized: Insufficient permissions" },
      { status: 403 },
    );
  }
  return null;
}

export async function GET(req: NextRequest) {
  const authCheck = await authMiddleware(req);
  if (authCheck) return authCheck;
  const guard = requireSuperadmin(req);
  if (guard) return guard;

  const companyId = req.nextUrl.searchParams.get("companyId");
  if (!companyId) {
    return NextResponse.json({ error: "companyId is verplicht" }, { status: 400 });
  }

  try {
    const [company, mapping] = await Promise.all([
      prisma.company.findUnique({
        where: { id: companyId },
        select: { id: true, title: true },
      }),
      getCompanyTerminology(companyId),
    ]);

    if (!company) {
      return NextResponse.json({ error: "Bedrijf niet gevonden" }, { status: 404 });
    }

    return NextResponse.json({
      company,
      phases: TERMINOLOGY_PHASES,
      topics: TERMINOLOGY_TOPICS,
      mapping,
    });
  } catch (error) {
    console.error("[terminology] Failed to load glossary:", error);
    return NextResponse.json(
      { error: "Kon terminologie niet laden" },
      { status: 500 },
    );
  }
}

export async function PUT(req: NextRequest) {
  const authCheck = await authMiddleware(req);
  if (authCheck) return authCheck;
  const guard = requireSuperadmin(req);
  if (guard) return guard;

  const requester = (req as any).user;

  let body: { companyId?: string; mapping?: unknown; sourceFilename?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige JSON" }, { status: 400 });
  }

  const { companyId, mapping, sourceFilename } = body;
  if (!companyId) {
    return NextResponse.json({ error: "companyId is verplicht" }, { status: 400 });
  }

  try {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true },
    });
    if (!company) {
      return NextResponse.json({ error: "Bedrijf niet gevonden" }, { status: 404 });
    }

    const saved = await setCompanyTerminology(
      companyId,
      mapping,
      requester?.id ?? null,
      sourceFilename ?? undefined,
    );

    return NextResponse.json({ mapping: saved });
  } catch (error) {
    console.error("[terminology] Failed to save glossary:", error);
    return NextResponse.json(
      { error: "Kon terminologie niet opslaan" },
      { status: 500 },
    );
  }
}
