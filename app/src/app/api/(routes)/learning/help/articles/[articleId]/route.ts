import { NextRequest, NextResponse } from "next/server";
import { learningAuthMiddleware } from "../../../../../middleware/authMiddleware";
import { LEARNING_ROLE } from "@/configs/constants";
import { learningHelpService } from "@/lib/services/learningHelpService";

type Params = { params: Promise<{ articleId: string }> };

/** GET — enkel artikel (view-teller +1, zoals productie). */
export async function GET(req: NextRequest, { params }: Params) {
  const authCheck = await learningAuthMiddleware(req, LEARNING_ROLE.LEARNER);
  if (authCheck) return authCheck;
  const { articleId } = await params;
  const article = await learningHelpService.getArticle(articleId);
  if (!article) {
    return NextResponse.json({ message: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ data: article });
}

/** PUT — artikel bijwerken (admin). */
export async function PUT(req: NextRequest, { params }: Params) {
  const authCheck = await learningAuthMiddleware(
    req,
    LEARNING_ROLE.LEARNING_ADMIN,
  );
  if (authCheck) return authCheck;
  const { articleId } = await params;
  const body = await req.json().catch(() => ({}));
  const updated = await learningHelpService.updateArticle(articleId, body);
  if (!updated) {
    return NextResponse.json({ message: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ data: updated });
}

/** DELETE — artikel verwijderen (admin). */
export async function DELETE(req: NextRequest, { params }: Params) {
  const authCheck = await learningAuthMiddleware(
    req,
    LEARNING_ROLE.LEARNING_ADMIN,
  );
  if (authCheck) return authCheck;
  const { articleId } = await params;
  await learningHelpService.deleteArticle(articleId);
  return NextResponse.json({ data: { deleted: true } });
}
