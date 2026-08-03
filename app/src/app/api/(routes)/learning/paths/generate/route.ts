import { NextRequest, NextResponse } from "next/server";
import { learningAuthMiddleware } from "../../../../middleware/authMiddleware";
import { learningPathsService } from "@/lib/services/learningPathsService";
import { LEARNING_ROLE } from "@/configs/constants";

/**
 * POST /api/learning/paths/generate — AI-leerpad uit een functieprofiel.
 * Body: { job_profile_text, language? }. Gebruikt de LiteLLM-gateway; de LLM
 * kiest alleen uit bestaande, voor deze beheerder zichtbare modules.
 */
export async function POST(req: NextRequest) {
  const authCheck = await learningAuthMiddleware(
    req,
    LEARNING_ROLE.LEARNING_ADMIN,
  );
  if (authCheck) return authCheck;
  const user = (req as any).user;
  const body = await req.json().catch(() => ({}));
  if (!body.job_profile_text) {
    return NextResponse.json(
      { message: "job_profile_text is required" },
      { status: 400 },
    );
  }
  const result = await learningPathsService.generatePathFromProfile(user, {
    job_profile_text: body.job_profile_text,
    language: body.language,
  });
  if ("error" in result) {
    const status = result.error === "invalid" ? 422 : 403;
    return NextResponse.json({ message: result.error }, { status });
  }
  return NextResponse.json({ data: result.data });
}
