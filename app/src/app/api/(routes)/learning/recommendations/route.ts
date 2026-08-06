import { NextRequest, NextResponse } from "next/server";
import { learningAuthMiddleware } from "../../../middleware/authMiddleware";
import { learningRecommendationsService } from "@/lib/services/learningRecommendationsService";
import { LEARNING_ROLE } from "@/configs/constants";

/**
 * GET /api/learning/recommendations — aanbevolen modules voor de ingelogde
 * learner, op basis van de zwakste PICA-fasen uit recente gespreksanalyses.
 */
export async function GET(req: NextRequest) {
  const authCheck = await learningAuthMiddleware(req, LEARNING_ROLE.LEARNER);
  if (authCheck) return authCheck;
  const user = (req as any).user;
  const data = await learningRecommendationsService.getRecommendations(
    user,
    req.nextUrl.searchParams.get("lang") || undefined,
  );
  return NextResponse.json({ data });
}
