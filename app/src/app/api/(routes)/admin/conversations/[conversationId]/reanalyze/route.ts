import { NextRequest, NextResponse } from "next/server";
import { authMiddleware } from "@/app/api/middleware/authMiddleware";
import { ConversationAnalysisService } from "@/app/api/services/conversationAnalysisService";
import { ConversationSummaryService } from "@/app/api/services/conversationSummaryService";
import { USER_ROLE } from "@/configs/constants";
import { UserModel } from "@/app/api/models/user";
import { prisma } from "@/app/api/utils/prisma";

export const dynamic = "force-dynamic";
/** Long calls can take ~2–3 minutes end-to-end via LiteLLM. */
export const maxDuration = 300;

/**
 * POST /api/admin/conversations/:conversationId/reanalyze
 *
 * Super-admin only. Re-runs LiteLLM analysis using the stored transcript_text
 * (no re-transcription). Optional ?force=true deletes existing summaries first.
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ conversationId: string }> },
) {
  const authCheck = await authMiddleware(req, USER_ROLE.SUPER_ADMIN);

  if (authCheck) return authCheck;

  const { conversationId } = await context.params;
  const force =
    req.nextUrl.searchParams.get("force") === "true" ||
    req.nextUrl.searchParams.get("force") === "1";

  if (!conversationId?.trim()) {
    return NextResponse.json(
      { message: "conversationId is required" },
      { status: 400 },
    );
  }

  try {
    const conversation = await prisma.userConversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        user_id: true,
        title: true,
        transcript_text: true,
        transcript_status: true,
        conversation_status: true,
        twinai_run_status: true,
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { message: "Conversation not found" },
        { status: 404 },
      );
    }

    const transcriptText = conversation.transcript_text?.trim();

    if (!transcriptText) {
      return NextResponse.json(
        {
          message:
            "No transcript_text on this conversation. Submit transcription first (assemble-and-process).",
          conversationId,
          transcript_status: conversation.transcript_status,
        },
        { status: 400 },
      );
    }

    const existingSummaries =
      await ConversationSummaryService.findByConversationId(conversationId);

    if (existingSummaries.length > 0 && !force) {
      return NextResponse.json(
        {
          message:
            "Analysis summary already exists. Pass ?force=true to delete and re-analyze.",
          conversationId,
          summaryCount: existingSummaries.length,
        },
        { status: 409 },
      );
    }

    if (existingSummaries.length > 0 && force) {
      await prisma.conversationSummaryX.deleteMany({
        where: { conversation_id: conversationId },
      });
      console.log(
        `[Admin/Reanalyze] Removed ${existingSummaries.length} summary(ies) for ${conversationId} (force=true)`,
      );
    }

    const userId = conversation.user_id;
    const langCode = await UserModel.getUserLangPreference(userId);

    console.log(
      `[Admin/Reanalyze] Starting for ${conversationId} (user ${userId}, ${transcriptText.length} chars)`,
    );

    const output = await ConversationAnalysisService.analyzeAndPersist(
      conversationId,
      userId,
      transcriptText,
      langCode,
    );

    const updated = await prisma.userConversation.findUnique({
      where: { id: conversationId },
      select: {
        conversation_status: true,
        twinai_run_status: true,
        transcript_status: true,
      },
    });

    const summary =
      await ConversationSummaryService.findByConversationId(conversationId);

    console.log(
      `[Admin/Reanalyze] Completed for ${conversationId}, score=${output.Totaalscore}`,
    );

    return NextResponse.json({
      success: true,
      message: "Conversation re-analyzed successfully",
      conversationId,
      userId,
      title: conversation.title,
      totalScore: output.Totaalscore,
      conversation_status: updated?.conversation_status,
      twinai_run_status: updated?.twinai_run_status,
      summaryId: summary[0]?.id ?? null,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Re-analysis failed";

    console.error(`[Admin/Reanalyze] Failed for ${conversationId}:`, error);

    return NextResponse.json(
      {
        success: false,
        message,
        conversationId,
      },
      { status: 500 },
    );
  }
}
