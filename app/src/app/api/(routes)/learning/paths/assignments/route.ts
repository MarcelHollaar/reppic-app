import { NextRequest, NextResponse } from "next/server";
import { learningAuthMiddleware } from "../../../../middleware/authMiddleware";
import { learningPathsService } from "@/lib/services/learningPathsService";
import { LEARNING_ROLE } from "@/configs/constants";

/**
 * POST /api/learning/paths/assignments — leerpad toewijzen aan medewerker.
 * Body: { user_id, path_id }. Materialiseert de pad-modules als
 * module-toewijzingen.
 */
export async function POST(req: NextRequest) {
  const authCheck = await learningAuthMiddleware(
    req,
    LEARNING_ROLE.LEARNING_ADMIN,
  );
  if (authCheck) return authCheck;
  const user = (req as any).user;
  const body = await req.json().catch(() => ({}));
  if (!body.user_id || !body.path_id) {
    return NextResponse.json(
      { message: "user_id and path_id are required" },
      { status: 400 },
    );
  }
  const result = await learningPathsService.assignPathToUser(
    user,
    body.user_id,
    body.path_id,
  );
  if ("error" in result) {
    const status = result.error === "not_found" ? 404 : 403;
    return NextResponse.json({ message: result.error }, { status });
  }
  return NextResponse.json({ data: result.data });
}

/** DELETE /api/learning/paths/assignments?user_id=…&path_id=… */
export async function DELETE(req: NextRequest) {
  const authCheck = await learningAuthMiddleware(
    req,
    LEARNING_ROLE.LEARNING_ADMIN,
  );
  if (authCheck) return authCheck;
  const user = (req as any).user;
  const userId = req.nextUrl.searchParams.get("user_id");
  const pathId = req.nextUrl.searchParams.get("path_id");
  if (!userId || !pathId) {
    return NextResponse.json(
      { message: "user_id and path_id are required" },
      { status: 400 },
    );
  }
  const result = await learningPathsService.removePathFromUser(
    user,
    userId,
    pathId,
  );
  if ("error" in result) {
    const status = result.error === "not_found" ? 404 : 403;
    return NextResponse.json({ message: result.error }, { status });
  }
  return NextResponse.json({ data: true });
}
