import { NextRequest, NextResponse } from "next/server";
import { learningAuthMiddleware } from "../../../../../middleware/authMiddleware";
import { learningService } from "@/lib/services/learningService";
import { LEARNING_ROLE } from "@/configs/constants";

/** POST /api/learning/modules/[moduleId]/progress — kijk-/leesvoortgang bijwerken. */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ moduleId: string }> },
) {
  const authCheck = await learningAuthMiddleware(req, LEARNING_ROLE.LEARNER);
  if (authCheck) return authCheck;

  const { moduleId } = await context.params;
  const user = (req as any).user;
  const body = await req.json().catch(() => ({}));
  const data = await learningService.updateProgress(user, moduleId, {
    progress: body.progress,
    time_spent_delta: body.time_spent_delta,
  });
  if (!data) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ data });
}
