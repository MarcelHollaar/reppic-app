import { NextRequest, NextResponse } from "next/server";
import { learningAuthMiddleware } from "../../../../../middleware/authMiddleware";
import { learningService } from "@/lib/services/learningService";
import { LEARNING_ROLE } from "@/configs/constants";

/**
 * POST /api/learning/modules/[moduleId]/quiz — antwoorden inleveren.
 * Body: { answers: { [questionId]: optionIndex } }
 * Beoordeling is server-side; bij slagen wordt een certificaat uitgereikt.
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ moduleId: string }> },
) {
  const authCheck = await learningAuthMiddleware(req, LEARNING_ROLE.LEARNER);
  if (authCheck) return authCheck;

  const { moduleId } = await context.params;
  const user = (req as any).user;
  const body = await req.json().catch(() => ({}));
  if (!body.answers || typeof body.answers !== "object") {
    return NextResponse.json(
      { message: "answers is required" },
      { status: 400 },
    );
  }
  const data = await learningService.submitQuiz(user, moduleId, body.answers);
  if (!data) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ data });
}
