import { NextRequest, NextResponse } from "next/server";
import { learningAuthMiddleware } from "../../../middleware/authMiddleware";
import { learningService } from "@/lib/services/learningService";
import { LEARNING_ROLE } from "@/configs/constants";

/**
 * GET /api/learning/progress — eigen voortgang + certificaten.
 * GET /api/learning/progress?user_id=… — voortgang van een teamlid/medewerker
 * (manager: eigen team; learning_admin: eigen bedrijf; superadmin: iedereen).
 */
export async function GET(req: NextRequest) {
  const authCheck = await learningAuthMiddleware(req, LEARNING_ROLE.LEARNER);
  if (authCheck) return authCheck;

  const user = (req as any).user;
  const targetUserId = req.nextUrl.searchParams.get("user_id") || undefined;
  const data = await learningService.getProgressSummary(user, targetUserId);
  if (!data) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json({ data });
}
