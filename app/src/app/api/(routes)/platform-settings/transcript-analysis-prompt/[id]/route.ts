import { NextRequest, NextResponse } from "next/server";
import { authMiddleware } from "../../../../middleware/authMiddleware";
import { USER_ROLE } from "@/configs/constants";
import { transcriptAnalysisPromptService } from "../../../../services/transcriptAnalysisPromptService";

export async function GET(
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
    const version = await transcriptAnalysisPromptService.getVersionById(id);

    if (!version) {
      return NextResponse.json(
        { message: "Prompt version not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: version });
  } catch (error) {
    console.error(
      "[platform-settings/transcript-analysis-prompt/:id] GET failed:",
      error,
    );

    return NextResponse.json(
      { message: "Failed to load prompt version" },
      { status: 500 },
    );
  }
}
