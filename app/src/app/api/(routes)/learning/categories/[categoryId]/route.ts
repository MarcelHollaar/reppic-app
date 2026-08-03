import { NextRequest, NextResponse } from "next/server";
import { learningAuthMiddleware } from "../../../../middleware/authMiddleware";
import { learningService } from "@/lib/services/learningService";
import { LEARNING_ROLE } from "@/configs/constants";

/** PUT /api/learning/categories/[categoryId] — leercategorie bijwerken (beheer). */
export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ categoryId: string }> },
) {
  const authCheck = await learningAuthMiddleware(
    req,
    LEARNING_ROLE.LEARNING_ADMIN,
  );
  if (authCheck) return authCheck;
  const { categoryId } = await context.params;
  const user = (req as any).user;
  const body = await req.json().catch(() => ({}));
  if (!body.name) {
    return NextResponse.json({ message: "name is required" }, { status: 400 });
  }
  const result = await learningService.upsertCategory(user, {
    ...body,
    id: categoryId,
  });
  if ("error" in result) {
    const status = result.error === "not_found" ? 404 : 403;
    return NextResponse.json({ message: result.error }, { status });
  }
  return NextResponse.json({ data: result.data });
}

/** DELETE /api/learning/categories/[categoryId] — leercategorie verwijderen (beheer). */
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ categoryId: string }> },
) {
  const authCheck = await learningAuthMiddleware(
    req,
    LEARNING_ROLE.LEARNING_ADMIN,
  );
  if (authCheck) return authCheck;
  const { categoryId } = await context.params;
  const user = (req as any).user;
  const result = await learningService.deleteCategory(user, categoryId);
  if ("error" in result) {
    const status = result.error === "not_found" ? 404 : 403;
    return NextResponse.json({ message: result.error }, { status });
  }
  return NextResponse.json({ data: true });
}
