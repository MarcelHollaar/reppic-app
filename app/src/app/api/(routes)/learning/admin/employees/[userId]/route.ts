import { NextRequest, NextResponse } from "next/server";
import { learningAuthMiddleware } from "../../../../../middleware/authMiddleware";
import { learningService } from "@/lib/services/learningService";
import { LEARNING_ROLE } from "@/configs/constants";

/** PATCH /api/learning/admin/employees/[userId] — leer-rol aanpassen. */
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ userId: string }> },
) {
  const authCheck = await learningAuthMiddleware(
    req,
    LEARNING_ROLE.LEARNING_ADMIN,
  );
  if (authCheck) return authCheck;

  const { userId } = await context.params;
  const user = (req as any).user;
  const body = await req.json().catch(() => ({}));
  if (!body.learning_role) {
    return NextResponse.json(
      { message: "learning_role is required" },
      { status: 400 },
    );
  }
  const result = await learningService.setLearningRole(
    user,
    userId,
    body.learning_role,
  );
  if ("error" in result) {
    const status =
      result.error === "not_found" ? 404 : result.error === "invalid" ? 400 : 403;
    return NextResponse.json({ message: result.error }, { status });
  }
  return NextResponse.json({ data: result.data });
}
