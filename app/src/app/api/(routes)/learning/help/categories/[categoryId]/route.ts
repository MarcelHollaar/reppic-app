import { NextRequest, NextResponse } from "next/server";
import { learningAuthMiddleware } from "../../../../../middleware/authMiddleware";
import { LEARNING_ROLE } from "@/configs/constants";
import { learningHelpService } from "@/lib/services/learningHelpService";

type Params = { params: Promise<{ categoryId: string }> };

/** PUT — helpcategorie bijwerken (admin). */
export async function PUT(req: NextRequest, { params }: Params) {
  const authCheck = await learningAuthMiddleware(
    req,
    LEARNING_ROLE.LEARNING_ADMIN,
  );
  if (authCheck) return authCheck;
  const { categoryId } = await params;
  const body = await req.json().catch(() => ({}));
  const updated = await learningHelpService.updateCategory(categoryId, body);
  if (!updated) {
    return NextResponse.json({ message: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ data: updated });
}

/** DELETE — helpcategorie verwijderen (admin); artikelen behouden (SetNull). */
export async function DELETE(req: NextRequest, { params }: Params) {
  const authCheck = await learningAuthMiddleware(
    req,
    LEARNING_ROLE.LEARNING_ADMIN,
  );
  if (authCheck) return authCheck;
  const { categoryId } = await params;
  await learningHelpService.deleteCategory(categoryId);
  return NextResponse.json({ data: { deleted: true } });
}
