import { NextRequest, NextResponse } from "next/server";
import { learningAuthMiddleware } from "../../../../../middleware/authMiddleware";
import { learningService } from "@/lib/services/learningService";
import { LEARNING_ROLE } from "@/configs/constants";

/** GET /api/learning/manage/modules/[moduleId] — beheerdetail (mét antwoorden). */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ moduleId: string }> },
) {
  const authCheck = await learningAuthMiddleware(
    req,
    LEARNING_ROLE.LEARNING_ADMIN,
  );
  if (authCheck) return authCheck;

  const { moduleId } = await context.params;
  const user = (req as any).user;
  const data = await learningService.getModuleForManage(user, moduleId);
  if (!data) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ data });
}

/** PUT /api/learning/manage/modules/[moduleId] — module bijwerken. */
export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ moduleId: string }> },
) {
  const authCheck = await learningAuthMiddleware(
    req,
    LEARNING_ROLE.LEARNING_ADMIN,
  );
  if (authCheck) return authCheck;

  const { moduleId } = await context.params;
  const user = (req as any).user;
  const body = await req.json().catch(() => ({}));
  const result = await learningService.upsertModule(user, {
    ...body,
    id: moduleId,
  });
  if ("error" in result) {
    const status =
      result.error === "not_found"
        ? 404
        : result.error === "lms_disabled"
          ? 402
          : 403;
    return NextResponse.json({ message: result.error }, { status });
  }
  return NextResponse.json({ data: result.data });
}

/** DELETE /api/learning/manage/modules/[moduleId] — soft delete. */
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ moduleId: string }> },
) {
  const authCheck = await learningAuthMiddleware(
    req,
    LEARNING_ROLE.LEARNING_ADMIN,
  );
  if (authCheck) return authCheck;

  const { moduleId } = await context.params;
  const user = (req as any).user;
  const result = await learningService.deleteModule(user, moduleId);
  if ("error" in result) {
    const status = result.error === "not_found" ? 404 : 403;
    return NextResponse.json({ message: result.error }, { status });
  }
  return NextResponse.json({ data: true });
}
