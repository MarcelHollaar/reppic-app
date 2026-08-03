import { NextRequest, NextResponse } from "next/server";
import { learningAuthMiddleware } from "../../../../../middleware/authMiddleware";
import { learningLibraryService } from "@/lib/services/learningLibraryService";
import { LEARNING_ROLE } from "@/configs/constants";

function toResponse(result: any) {
  if ("error" in result) {
    const status =
      result.error === "not_found"
        ? 404
        : result.error === "invalid"
          ? 400
          : result.error === "no_knowledge_access"
            ? 402
            : 403;
    return NextResponse.json({ message: result.error }, { status });
  }
  return NextResponse.json({ data: result.data });
}

/** PUT — bibliotheek-categorie bijwerken (beheer). */
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
  const companyId = req.nextUrl.searchParams.get("company_id");
  return toResponse(
    await learningLibraryService.upsertCategory(
      user,
      { ...body, id: categoryId },
      companyId,
    ),
  );
}

/** DELETE — bibliotheek-categorie verwijderen (beheer). */
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
  const companyId = req.nextUrl.searchParams.get("company_id");
  return toResponse(
    await learningLibraryService.deleteCategory(user, categoryId, companyId),
  );
}
