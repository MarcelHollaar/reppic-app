import { NextRequest, NextResponse } from "next/server";
import { learningAuthMiddleware } from "../../../../middleware/authMiddleware";
import { learningPathsService } from "@/lib/services/learningPathsService";
import { LEARNING_ROLE } from "@/configs/constants";

/** PUT /api/learning/job-roles/[jobRoleId] — functierol bijwerken. */
export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ jobRoleId: string }> },
) {
  const authCheck = await learningAuthMiddleware(
    req,
    LEARNING_ROLE.LEARNING_ADMIN,
  );
  if (authCheck) return authCheck;
  const { jobRoleId } = await context.params;
  const user = (req as any).user;
  const body = await req.json().catch(() => ({}));
  const result = await learningPathsService.upsertJobRole(user, {
    ...body,
    id: jobRoleId,
  });
  if ("error" in result) {
    const status =
      result.error === "not_found" ? 404 : result.error === "invalid" ? 400 : 403;
    return NextResponse.json({ message: result.error }, { status });
  }
  return NextResponse.json({ data: result.data });
}

/** DELETE /api/learning/job-roles/[jobRoleId] — functierol verwijderen. */
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ jobRoleId: string }> },
) {
  const authCheck = await learningAuthMiddleware(
    req,
    LEARNING_ROLE.LEARNING_ADMIN,
  );
  if (authCheck) return authCheck;
  const { jobRoleId } = await context.params;
  const user = (req as any).user;
  const result = await learningPathsService.deleteJobRole(user, jobRoleId);
  if ("error" in result) {
    const status = result.error === "not_found" ? 404 : 403;
    return NextResponse.json({ message: result.error }, { status });
  }
  return NextResponse.json({ data: true });
}
