import { NextRequest, NextResponse } from "next/server";
import { authMiddleware } from "../../../middleware/authMiddleware";
import { USER_ROLE } from "@/configs/constants";
import { prepAnalysisPromptService } from "../../../services/prepAnalysisPromptService";

export async function GET(req: NextRequest) {
  const authCheck = await authMiddleware(req, USER_ROLE.SUPER_ADMIN);
  if (authCheck) return authCheck;

  try {
    const active = await prepAnalysisPromptService.getActiveVersion();

    return NextResponse.json({ data: active });
  } catch (error) {
    console.error("[platform-settings/prep-analysis-prompt] GET failed:", error);

    return NextResponse.json(
      { message: "Failed to load prep analysis prompt" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const authCheck = await authMiddleware(req, USER_ROLE.SUPER_ADMIN);
  if (authCheck) return authCheck;

  try {
    const body = await req.json();
    const content = typeof body?.content === "string" ? body.content : "";
    const note = typeof body?.note === "string" ? body.note : undefined;
    const activate = body?.activate !== false;

    if (!content.trim()) {
      return NextResponse.json(
        { message: "Prompt content is required" },
        { status: 400 },
      );
    }

    const validation = prepAnalysisPromptService.validateContent(content);

    if (!validation.valid) {
      return NextResponse.json(
        {
          message: "Prompt validation failed",
          validation,
        },
        { status: 400 },
      );
    }

    const user = (req as any).user;
    const created = await prepAnalysisPromptService.createVersion({
      content,
      note,
      createdBy: user?.id,
      activate,
    });

    return NextResponse.json({ data: created, validation });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to save prep analysis prompt";

    console.error("[platform-settings/prep-analysis-prompt] POST failed:", error);

    return NextResponse.json({ message }, { status: 400 });
  }
}
