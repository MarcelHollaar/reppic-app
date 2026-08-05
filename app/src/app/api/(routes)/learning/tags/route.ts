import { NextRequest, NextResponse } from "next/server";
import { learningAuthMiddleware } from "../../../middleware/authMiddleware";
import { LEARNING_ROLE } from "@/configs/constants";
import { prisma } from "@/app/api/utils/prisma";

/** GET /api/learning/tags — alle leertags (beheer; port van productie /api/tags). */
export async function GET(req: NextRequest) {
  const authCheck = await learningAuthMiddleware(
    req,
    LEARNING_ROLE.LEARNING_ADMIN,
  );
  if (authCheck) return authCheck;
  const tags = await prisma.learningTag.findMany({
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ data: tags });
}

/** POST — tag aanmaken. Body: { name, category?, description? }. */
export async function POST(req: NextRequest) {
  const authCheck = await learningAuthMiddleware(
    req,
    LEARNING_ROLE.LEARNING_ADMIN,
  );
  if (authCheck) return authCheck;
  const user = (req as any).user;
  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "").toLowerCase().trim();
  if (!name) {
    return NextResponse.json({ message: "invalid" }, { status: 400 });
  }
  try {
    const tag = await prisma.learningTag.create({
      data: {
        name,
        category: body.category || null,
        description: body.description || null,
        created_by: user.id,
      },
    });
    return NextResponse.json({ data: tag }, { status: 201 });
  } catch {
    return NextResponse.json({ message: "duplicate" }, { status: 409 });
  }
}
