import { NextRequest, NextResponse } from "next/server";
import { learningAuthMiddleware } from "../../../../../../middleware/authMiddleware";
import { learningPathsService } from "@/lib/services/learningPathsService";
import { LEARNING_ROLE } from "@/configs/constants";

/** GET — functierol-koppelingen van een module (beheer). */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ moduleId: string }> },
) {
  const authCheck = await learningAuthMiddleware(
    req,
    LEARNING_ROLE.LEARNING_ADMIN,
  );
  if (authCheck) return authCheck;
  const { moduleId } = await context.params;
  const user = (req as any).user;
  const data = await learningPathsService.getModuleJobRoles(user, moduleId);
  if (!data) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json({ data });
}

/**
 * POST — vervangt de functierol-koppelingen van een module.
 * Body: { job_roles: [{ job_role_id, visibility }] }
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ moduleId: string }> },
) {
  const authCheck = await learningAuthMiddleware(
    req,
    LEARNING_ROLE.LEARNING_ADMIN,
  );
  if (authCheck) return authCheck;
  const { moduleId } = await context.params;
  const user = (req as any).user;
  const body = await req.json().catch(() => ({}));
  if (!Array.isArray(body.job_roles)) {
    return NextResponse.json(
      { message: "job_roles must be an array" },
      { status: 400 },
    );
  }
  const result = await learningPathsService.setModuleJobRoles(
    user,
    moduleId,
    body.job_roles,
  );
  if ("error" in result) {
    const status = result.error === "not_found" ? 404 : 403;
    return NextResponse.json({ message: result.error }, { status });
  }
  return NextResponse.json({ data: result.data });
}
