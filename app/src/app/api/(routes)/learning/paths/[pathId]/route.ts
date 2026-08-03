import { NextRequest, NextResponse } from "next/server";
import { learningAuthMiddleware } from "../../../../middleware/authMiddleware";
import { learningPathsService } from "@/lib/services/learningPathsService";
import { LEARNING_ROLE } from "@/configs/constants";

/** GET /api/learning/paths/[pathId] — leerpad-detail met modules. */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ pathId: string }> },
) {
  const authCheck = await learningAuthMiddleware(req, LEARNING_ROLE.LEARNER);
  if (authCheck) return authCheck;
  const { pathId } = await context.params;
  const user = (req as any).user;
  const data = await learningPathsService.getPath(user, pathId);
  if (!data) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ data });
}

/** PUT /api/learning/paths/[pathId] — leerpad bijwerken (beheer). */
export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ pathId: string }> },
) {
  const authCheck = await learningAuthMiddleware(
    req,
    LEARNING_ROLE.LEARNING_ADMIN,
  );
  if (authCheck) return authCheck;
  const { pathId } = await context.params;
  const user = (req as any).user;
  const body = await req.json().catch(() => ({}));
  const result = await learningPathsService.upsertPath(user, {
    ...body,
    id: pathId,
  });
  if ("error" in result) {
    const status =
      result.error === "not_found" ? 404 : result.error === "invalid" ? 400 : 403;
    return NextResponse.json({ message: result.error }, { status });
  }
  return NextResponse.json({ data: result.data });
}

/** DELETE /api/learning/paths/[pathId] — leerpad verwijderen (beheer). */
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ pathId: string }> },
) {
  const authCheck = await learningAuthMiddleware(
    req,
    LEARNING_ROLE.LEARNING_ADMIN,
  );
  if (authCheck) return authCheck;
  const { pathId } = await context.params;
  const user = (req as any).user;
  const result = await learningPathsService.deletePath(user, pathId);
  if ("error" in result) {
    const status = result.error === "not_found" ? 404 : 403;
    return NextResponse.json({ message: result.error }, { status });
  }
  return NextResponse.json({ data: true });
}
