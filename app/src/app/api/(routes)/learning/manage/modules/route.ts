import { NextRequest, NextResponse } from "next/server";
import { learningAuthMiddleware } from "../../../../middleware/authMiddleware";
import { learningService } from "@/lib/services/learningService";
import { updateModuleEmbedding } from "@/lib/services/learningPathAnalysisService";
import { LEARNING_ROLE } from "@/configs/constants";

/** POST /api/learning/manage/modules — module aanmaken (met quizvragen). */
export async function POST(req: NextRequest) {
  const authCheck = await learningAuthMiddleware(
    req,
    LEARNING_ROLE.LEARNING_ADMIN,
  );
  if (authCheck) return authCheck;

  const user = (req as any).user;
  const body = await req.json().catch(() => ({}));
  if (!body.title) {
    return NextResponse.json({ message: "title is required" }, { status: 400 });
  }
  const result = await learningService.upsertModule(user, body);
  if ("error" in result) {
    const status =
      result.error === "not_found"
        ? 404
        : result.error === "lms_disabled"
          ? 402
          : 403;
    return NextResponse.json({ message: result.error }, { status });
  }
  // Embedding voor de semantische leerpad-matching verversen (P4) —
  // fire-and-forget: nooit blokkerend voor het opslaan zelf.
  const savedId = (result.data as any)?.id;
  if (savedId) {
    updateModuleEmbedding(savedId).catch(() => {});
  }
  return NextResponse.json({ data: result.data });
}
