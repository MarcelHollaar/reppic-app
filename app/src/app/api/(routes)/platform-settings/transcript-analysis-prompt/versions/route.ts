import { NextRequest, NextResponse } from "next/server";
import { authMiddleware } from "../../../../middleware/authMiddleware";
import { USER_ROLE } from "@/configs/constants";
import { transcriptAnalysisPromptService } from "../../../../services/transcriptAnalysisPromptService";

export async function GET(req: NextRequest) {
  const authCheck = await authMiddleware(req, USER_ROLE.SUPER_ADMIN);
  if (authCheck) return authCheck;

  try {
    const versions = await transcriptAnalysisPromptService.listVersions();

    return NextResponse.json({ data: versions });
  } catch (error) {
    console.error(
      "[platform-settings/transcript-analysis-prompt/versions] GET failed:",
      error,
    );

    return NextResponse.json(
      { message: "Failed to load prompt versions" },
      { status: 500 },
    );
  }
}
