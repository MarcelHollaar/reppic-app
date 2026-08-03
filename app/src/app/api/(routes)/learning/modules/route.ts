import { NextRequest, NextResponse } from "next/server";
import { learningAuthMiddleware } from "../../../middleware/authMiddleware";
import { learningService } from "@/lib/services/learningService";
import { LEARNING_ROLE } from "@/configs/constants";

/** GET /api/learning/modules — modules zichtbaar voor de ingelogde learner. */
export async function GET(req: NextRequest) {
  const authCheck = await learningAuthMiddleware(req, LEARNING_ROLE.LEARNER);
  if (authCheck) return authCheck;

  const user = (req as any).user;
  const searchParams = req.nextUrl.searchParams;
  const data = await learningService.getModulesForUser(user, {
    type: searchParams.get("type") || undefined,
    categoryId: searchParams.get("category") || undefined,
  });
  return NextResponse.json({ data });
}
