import { NextRequest, NextResponse } from "next/server";
import { learningAuthMiddleware, authMiddleware } from "../../../../middleware/authMiddleware";
import { LEARNING_ROLE, USER_ROLE } from "@/configs/constants";
import { learningHelpService } from "@/lib/services/learningHelpService";

/** GET /api/learning/help/categories — alle helpcategorieën. */
export async function GET(req: NextRequest) {
  const authCheck = await learningAuthMiddleware(req, LEARNING_ROLE.LEARNER);
  if (authCheck) return authCheck;
  return NextResponse.json({ data: await learningHelpService.getCategories() });
}

/** POST — categorie aanmaken (admin). */
export async function POST(req: NextRequest) {
  // Platform-brede content (geen company_id) → beheer alleen door superadmin.
  const authCheck = await authMiddleware(req, USER_ROLE.SUPER_ADMIN);
  if (authCheck) return authCheck;
  const body = await req.json().catch(() => ({}));
  if (!body.name?.trim()) {
    return NextResponse.json({ message: "invalid" }, { status: 400 });
  }
  const category = await learningHelpService.createCategory(body);
  return NextResponse.json({ data: category }, { status: 201 });
}
