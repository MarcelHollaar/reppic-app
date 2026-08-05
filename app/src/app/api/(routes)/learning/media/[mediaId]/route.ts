import { NextRequest, NextResponse } from "next/server";
import { learningAuthMiddleware } from "../../../../middleware/authMiddleware";
import { LEARNING_ROLE } from "@/configs/constants";
import { learningMediaService } from "@/lib/services/learningMediaService";

type Params = { params: Promise<{ mediaId: string }> };

function toResponse(result: any) {
  if ("error" in result) {
    const status = result.error === "not_found" ? 404 : 403;
    return NextResponse.json({ message: result.error }, { status });
  }
  return NextResponse.json({ data: result.data });
}

/** GET — één media-item (zichtbaarheidscheck zoals productie). */
export async function GET(req: NextRequest, { params }: Params) {
  const authCheck = await learningAuthMiddleware(
    req,
    LEARNING_ROLE.LEARNING_ADMIN,
  );
  if (authCheck) return authCheck;
  const { mediaId } = await params;
  return toResponse(
    await learningMediaService.get((req as any).user, mediaId),
  );
}

/** PUT — naam/tags bijwerken (company/uploader onwijzigbaar, zoals productie). */
export async function PUT(req: NextRequest, { params }: Params) {
  const authCheck = await learningAuthMiddleware(
    req,
    LEARNING_ROLE.LEARNING_ADMIN,
  );
  if (authCheck) return authCheck;
  const { mediaId } = await params;
  const body = await req.json().catch(() => ({}));
  return toResponse(
    await learningMediaService.update((req as any).user, mediaId, {
      name: typeof body.name === "string" ? body.name : undefined,
      tags: Array.isArray(body.tags) ? body.tags.map(String) : undefined,
    }),
  );
}

/** DELETE — media-item verwijderen. */
export async function DELETE(req: NextRequest, { params }: Params) {
  const authCheck = await learningAuthMiddleware(
    req,
    LEARNING_ROLE.LEARNING_ADMIN,
  );
  if (authCheck) return authCheck;
  const { mediaId } = await params;
  return toResponse(
    await learningMediaService.remove((req as any).user, mediaId),
  );
}
