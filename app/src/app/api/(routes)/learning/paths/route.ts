import { NextRequest, NextResponse } from "next/server";
import { learningAuthMiddleware } from "../../../middleware/authMiddleware";
import { learningPathsService } from "@/lib/services/learningPathsService";
import { LEARNING_ROLE } from "@/configs/constants";

/** GET /api/learning/paths — zichtbare leerpaden (globaal + eigen bedrijf). */
export async function GET(req: NextRequest) {
  const authCheck = await learningAuthMiddleware(req, LEARNING_ROLE.LEARNER);
  if (authCheck) return authCheck;
  const user = (req as any).user;
  const data = await learningPathsService.getPaths(user);
  return NextResponse.json({ data });
}

/** POST /api/learning/paths — leerpad aanmaken/bijwerken (beheer). */
export async function POST(req: NextRequest) {
  const authCheck = await learningAuthMiddleware(
    req,
    LEARNING_ROLE.LEARNING_ADMIN,
  );
  if (authCheck) return authCheck;
  const user = (req as any).user;
  const body = await req.json().catch(() => ({}));
  const result = await learningPathsService.upsertPath(user, body);
  if ("error" in result) {
    const status =
      result.error === "not_found" ? 404 : result.error === "invalid" ? 400 : 403;
    return NextResponse.json({ message: result.error }, { status });
  }
  return NextResponse.json({ data: result.data });
}
