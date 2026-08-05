import { NextRequest, NextResponse } from "next/server";
import { authMiddleware } from "../../../../../middleware/authMiddleware";
import { USER_ROLE } from "@/configs/constants";
import { updateAllModuleEmbeddings } from "@/lib/services/learningPathAnalysisService";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * POST /api/learning/manage/modules/embeddings — module-embeddings (bij)
 * genereren voor de semantische leerpad-matching (1-op-1 met productie
 * updateAllModuleEmbeddings). Body: { all?: true } om ook bestaande te
 * verversen (bv. na een modelwissel); standaard alleen ontbrekende.
 */
export async function POST(req: NextRequest) {
  // Platform-brede, dure operatie over álle bedrijven → alleen superadmin.
  const authCheck = await authMiddleware(req, USER_ROLE.SUPER_ADMIN);
  if (authCheck) return authCheck;
  const body = await req.json().catch(() => ({}));
  try {
    const result = await updateAllModuleEmbeddings(body.all !== true);
    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("[learning/manage/modules/embeddings] failed:", error);
    return NextResponse.json({ message: "embeddings_failed" }, { status: 500 });
  }
}
