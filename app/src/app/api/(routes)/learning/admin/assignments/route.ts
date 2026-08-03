import { NextRequest, NextResponse } from "next/server";
import { learningAuthMiddleware } from "../../../../middleware/authMiddleware";
import { learningService } from "@/lib/services/learningService";
import { LEARNING_ROLE } from "@/configs/constants";

/**
 * POST /api/learning/admin/assignments — modules toewijzen.
 * Body: { user_id, module_ids: string[], is_required?, due_date? }
 */
export async function POST(req: NextRequest) {
  const authCheck = await learningAuthMiddleware(
    req,
    LEARNING_ROLE.LEARNING_ADMIN,
  );
  if (authCheck) return authCheck;

  const user = (req as any).user;
  const body = await req.json().catch(() => ({}));
  if (!body.user_id || !Array.isArray(body.module_ids)) {
    return NextResponse.json(
      { message: "user_id and module_ids are required" },
      { status: 400 },
    );
  }
  const result = await learningService.assignModules(
    user,
    body.user_id,
    body.module_ids,
    body.is_required !== false,
    body.due_date || null,
  );
  if ("error" in result) {
    const status = result.error === "not_found" ? 404 : 403;
    return NextResponse.json({ message: result.error }, { status });
  }
  return NextResponse.json({ data: result.data });
}

/**
 * DELETE /api/learning/admin/assignments?user_id=…&module_id=…
 */
export async function DELETE(req: NextRequest) {
  const authCheck = await learningAuthMiddleware(
    req,
    LEARNING_ROLE.LEARNING_ADMIN,
  );
  if (authCheck) return authCheck;

  const user = (req as any).user;
  const userId = req.nextUrl.searchParams.get("user_id");
  const moduleId = req.nextUrl.searchParams.get("module_id");
  if (!userId || !moduleId) {
    return NextResponse.json(
      { message: "user_id and module_id are required" },
      { status: 400 },
    );
  }
  const result = await learningService.removeAssignment(user, userId, moduleId);
  if ("error" in result) {
    return NextResponse.json({ message: result.error }, { status: 403 });
  }
  return NextResponse.json({ data: true });
}
