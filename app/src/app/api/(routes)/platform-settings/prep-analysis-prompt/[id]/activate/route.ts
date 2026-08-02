import { NextRequest, NextResponse } from "next/server";
import { authMiddleware } from "../../../../../middleware/authMiddleware";
import { USER_ROLE } from "@/configs/constants";
import { prepAnalysisPromptService } from "../../../../../services/prepAnalysisPromptService";

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const authCheck = await authMiddleware(req, USER_ROLE.SUPER_ADMIN);
  if (authCheck) return authCheck;

  const { id } = await context.params;

  if (!id?.trim()) {
    return NextResponse.json(
      { message: "Version id is required" },
      { status: 400 },
    );
  }

  try {
    const activated = await prepAnalysisPromptService.activateVersion(id);

    return NextResponse.json({ data: activated });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to activate prompt version";

    console.error(
      "[platform-settings/prep-analysis-prompt/activate] PUT failed:",
      error,
    );

    const status = message.includes("not found") ? 404 : 400;

    return NextResponse.json({ message }, { status });
  }
}
