import { NextRequest, NextResponse } from "next/server";
import { learningAuthMiddleware } from "../../../../middleware/authMiddleware";
import { LEARNING_ROLE } from "@/configs/constants";
import { prisma } from "@/app/api/utils/prisma";

type Params = { params: Promise<{ tagId: string }> };

/** PUT — leertag bijwerken (naam/categorie/beschrijving). */
export async function PUT(req: NextRequest, { params }: Params) {
  const authCheck = await learningAuthMiddleware(
    req,
    LEARNING_ROLE.LEARNING_ADMIN,
  );
  if (authCheck) return authCheck;
  const { tagId } = await params;
  const body = await req.json().catch(() => ({}));
  try {
    const tag = await prisma.learningTag.update({
      where: { id: tagId },
      data: {
        ...(body.name ? { name: String(body.name).toLowerCase().trim() } : {}),
        ...(body.category !== undefined ? { category: body.category } : {}),
        ...(body.description !== undefined
          ? { description: body.description }
          : {}),
      },
    });
    return NextResponse.json({ data: tag });
  } catch {
    return NextResponse.json({ message: "not_found" }, { status: 404 });
  }
}

/** DELETE — leertag verwijderen. */
export async function DELETE(req: NextRequest, { params }: Params) {
  const authCheck = await learningAuthMiddleware(
    req,
    LEARNING_ROLE.LEARNING_ADMIN,
  );
  if (authCheck) return authCheck;
  const { tagId } = await params;
  await prisma.learningTag.delete({ where: { id: tagId } }).catch(() => {});
  return NextResponse.json({ data: { deleted: true } });
}
