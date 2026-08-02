import { NextRequest, NextResponse } from "next/server";
import { authMiddleware } from "../../../../middleware/authMiddleware";
import { USER_ROLE } from "@/configs/constants";
import { prepAnalysisPromptService } from "../../../../services/prepAnalysisPromptService";

export async function POST(req: NextRequest) {
  const authCheck = await authMiddleware(req, USER_ROLE.SUPER_ADMIN);
  if (authCheck) return authCheck;

  try {
    const body = await req.json();
    const content = typeof body?.content === "string" ? body.content : "";

    const validation = prepAnalysisPromptService.validateContent(content);

    return NextResponse.json({ data: validation });
  } catch (error) {
    console.error(
      "[platform-settings/prep-analysis-prompt/validate] POST failed:",
      error,
    );

    return NextResponse.json(
      { message: "Failed to validate prompt" },
      { status: 500 },
    );
  }
}
