import { NextRequest, NextResponse } from "next/server";
import { learningAuthMiddleware } from "../../../../middleware/authMiddleware";
import { LEARNING_ROLE } from "@/configs/constants";
import {
  matchModulesToJobProfile,
  categorizeMatches,
} from "@/lib/services/learningPathAnalysisService";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * POST /api/learning/paths/match — stap 2 van de embedding-leerpadflow
 * (1-op-1 met productie /api/learning-paths/match-modules).
 * Body: { competencies: [...], jobProfileText }. Antwoord: matches met
 * scores (60% tags / 40% semantisch) + prioriteitsindeling.
 */
export async function POST(req: NextRequest) {
  const authCheck = await learningAuthMiddleware(
    req,
    LEARNING_ROLE.LEARNING_ADMIN,
  );
  if (authCheck) return authCheck;

  const body = await req.json().catch(() => ({}));
  if (!Array.isArray(body.competencies)) {
    return NextResponse.json({ message: "invalid" }, { status: 400 });
  }
  try {
    const result = await matchModulesToJobProfile(
      body.competencies,
      String(body.jobProfileText || ""),
    );
    return NextResponse.json({
      data: { ...result, categorized: categorizeMatches(result.matches) },
    });
  } catch (error) {
    console.error("[learning/paths/match] failed:", error);
    return NextResponse.json({ message: "match_failed" }, { status: 500 });
  }
}
