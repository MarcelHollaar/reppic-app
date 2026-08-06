import { NextRequest, NextResponse } from "next/server";
import { learningAuthMiddleware } from "../../../../../middleware/authMiddleware";
import { learningService } from "@/lib/services/learningService";
import { LEARNING_ROLE } from "@/configs/constants";

/**
 * POST /api/learning/modules/[moduleId]/reset — eigen voortgang van een module
 * terugzetten zodat video + quiz opnieuw gedaan kunnen worden (keuze van de
 * gebruiker). Certificaten blijven staan.
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ moduleId: string }> },
) {
  const authCheck = await learningAuthMiddleware(req, LEARNING_ROLE.LEARNER);
  if (authCheck) return authCheck;

  const { moduleId } = await context.params;
  const user = (req as any).user;
  const data = await learningService.resetProgress(user, moduleId);
  if (!data) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ data });
}
