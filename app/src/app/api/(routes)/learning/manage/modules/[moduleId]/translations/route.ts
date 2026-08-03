import { NextRequest, NextResponse } from "next/server";
import { learningAuthMiddleware } from "../../../../../../middleware/authMiddleware";
import { learningTranslationService } from "@/lib/services/learningTranslationService";
import { LEARNING_ROLE } from "@/configs/constants";

/** GET — welke talen zijn al vertaald voor deze module. */
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
  const data = await learningTranslationService.getTranslationStatus(
    user,
    moduleId,
  );
  if (!data) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  return NextResponse.json({ data });
}

/** POST — vertalingen genereren. Body: { languages: string[] }. */
export async function POST(
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
  if (!Array.isArray(body.languages)) {
    return NextResponse.json(
      { message: "languages must be an array" },
      { status: 400 },
    );
  }
  const result = await learningTranslationService.generateTranslations(
    user,
    moduleId,
    body.languages,
  );
  if ("error" in result) {
    const status =
      result.error === "not_found" ? 404 : result.error === "invalid" ? 422 : 403;
    return NextResponse.json({ message: result.error }, { status });
  }
  return NextResponse.json({ data: result.data });
}

/** DELETE ?language=xx — één vertaling verwijderen. */
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
  const language = req.nextUrl.searchParams.get("language");
  if (!language) {
    return NextResponse.json({ message: "language is required" }, { status: 400 });
  }
  const result = await learningTranslationService.deleteTranslation(
    user,
    moduleId,
    language,
  );
  if ("error" in result) {
    const status = result.error === "not_found" ? 404 : 403;
    return NextResponse.json({ message: result.error }, { status });
  }
  return NextResponse.json({ data: true });
}
