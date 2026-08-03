import { NextRequest, NextResponse } from "next/server";
import { learningAuthMiddleware } from "../../../../../../middleware/authMiddleware";
import { learningLibraryService } from "@/lib/services/learningLibraryService";
import { LEARNING_ROLE } from "@/configs/constants";

/** POST — favoriet aan/uit voor de ingelogde gebruiker. */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ documentId: string }> },
) {
  const authCheck = await learningAuthMiddleware(req, LEARNING_ROLE.LEARNER);
  if (authCheck) return authCheck;
  const { documentId } = await context.params;
  const user = (req as any).user;
  const result = await learningLibraryService.toggleFavorite(user, documentId);
  if ("error" in result) {
    const status = result.error === "not_found" ? 404 : 403;
    return NextResponse.json({ message: result.error }, { status });
  }
  return NextResponse.json({ data: result.data });
}
