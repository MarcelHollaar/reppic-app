import { NextRequest, NextResponse } from "next/server";
import { learningAuthMiddleware } from "../../../middleware/authMiddleware";
import { learningService } from "@/lib/services/learningService";
import { LEARNING_ROLE } from "@/configs/constants";

/** GET /api/learning/categories — zichtbare leercategorieën (globaal + eigen bedrijf). */
export async function GET(req: NextRequest) {
  const authCheck = await learningAuthMiddleware(req, LEARNING_ROLE.LEARNER);
  if (authCheck) return authCheck;

  const user = (req as any).user;
  const type = req.nextUrl.searchParams.get("type") || undefined;
  const data = await learningService.getCategories(user, type);
  return NextResponse.json({ data });
}

/** POST /api/learning/categories — categorie aanmaken/bijwerken (beheer). */
export async function POST(req: NextRequest) {
  const authCheck = await learningAuthMiddleware(
    req,
    LEARNING_ROLE.LEARNING_ADMIN,
  );
  if (authCheck) return authCheck;

  const user = (req as any).user;
  const body = await req.json().catch(() => ({}));
  if (!body.name) {
    return NextResponse.json({ message: "name is required" }, { status: 400 });
  }
  const result = await learningService.upsertCategory(user, body);
  if ("error" in result) {
    const status = result.error === "not_found" ? 404 : 403;
    return NextResponse.json({ message: result.error }, { status });
  }
  return NextResponse.json({ data: result.data });
}
