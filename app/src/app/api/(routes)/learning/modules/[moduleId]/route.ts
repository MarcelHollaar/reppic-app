import { NextRequest, NextResponse } from "next/server";
import { learningAuthMiddleware } from "../../../../middleware/authMiddleware";
import { learningService } from "@/lib/services/learningService";
import { LEARNING_ROLE } from "@/configs/constants";

/** GET /api/learning/modules/[moduleId] — detail + quizvragen (zonder antwoorden). */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ moduleId: string }> },
) {
  const authCheck = await learningAuthMiddleware(req, LEARNING_ROLE.LEARNER);
  if (authCheck) return authCheck;

  const { moduleId } = await context.params;
  const user = (req as any).user;
  // Taalkeuze uit ?lang= (learner-UI stuurt de actieve i18n-taal mee);
  // valt server-side terug op de originele module-content.
  const language = req.nextUrl.searchParams.get("lang") || undefined;
  const data = await learningService.getModuleForUser(user, moduleId, language);
  if (!data) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ data });
}
