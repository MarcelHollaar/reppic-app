import { NextRequest, NextResponse } from "next/server";
import { learningAuthMiddleware } from "../../../../middleware/authMiddleware";
import { LEARNING_ROLE, USER_ROLE } from "@/configs/constants";
import { createPathFromAnalysis } from "@/lib/services/learningPathAnalysisService";

/**
 * POST /api/learning/paths/create-from-analysis — stap 3 van de
 * embedding-leerpadflow (1-op-1 met productie). Body:
 * { job_function, level, description?, job_role_id?, selectedModuleIds,
 *   competencies, jobProfileText }.
 * Superadmin kan met ?company_id=… voor een bedrijf aanmaken (of globaal
 * zonder), learning_admin altijd voor het eigen bedrijf.
 */
export async function POST(req: NextRequest) {
  const authCheck = await learningAuthMiddleware(
    req,
    LEARNING_ROLE.LEARNING_ADMIN,
  );
  if (authCheck) return authCheck;
  const user = (req as any).user;

  const body = await req.json().catch(() => ({}));
  if (
    !body.job_function?.trim() ||
    !Array.isArray(body.selectedModuleIds) ||
    body.selectedModuleIds.length === 0 ||
    !Array.isArray(body.competencies)
  ) {
    return NextResponse.json({ message: "invalid" }, { status: 400 });
  }

  const isSuperAdmin = user?.role?.name === USER_ROLE.SUPER_ADMIN;
  const companyId = isSuperAdmin
    ? req.nextUrl.searchParams.get("company_id") || null
    : user.company_id;

  try {
    const result = await createPathFromAnalysis({
      jobFunction: body.job_function,
      level: body.level || "medior",
      description: body.description || null,
      companyId,
      jobRoleId: body.job_role_id || null,
      selectedModuleIds: body.selectedModuleIds.map(String),
      competencies: body.competencies,
      jobProfileText: String(body.jobProfileText || ""),
    });
    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("[learning/paths/create-from-analysis] failed:", error);
    return NextResponse.json({ message: "create_failed" }, { status: 500 });
  }
}
