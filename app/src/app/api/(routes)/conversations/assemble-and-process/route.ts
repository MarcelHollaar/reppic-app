import { AssemblyAIService } from "@/app/api/services/assemblyAIService";
import { ConversationService } from "@/app/api/services/conversationService";
import { hasFilePath } from "@/app/api/utils/fileStorage";
import { CONVERSATION_STATUS, TWIN_AI_STATUS } from "@/configs/constants";
import { NextRequest, NextResponse } from "next/server";
import { authMiddleware } from "../../../middleware/authMiddleware";
import { getCallbackBaseUrl } from "@/app/api/utils/requestOrigin";

const FTP_PUBLIC_URL = process.env.FTP_PUBLIC_URL;
const RECORDINGS_FOLDER = process.env.RECORDINGS_FOLDER;
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const authCheck = await authMiddleware(req);

  if (authCheck) return authCheck;

  try {
    const body = await req.json();
    const { conversationId } = body;

    if (!conversationId) {
      return NextResponse.json(
        { message: "Missing required fields: conversationId" },
        { status: 400 },
      );
    }

    const authenticatedUser = (req as any).user;

    if (!authenticatedUser?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const userId = authenticatedUser.id;

    // Update conversation status to processing
    await ConversationService.updateConversationX(
      {
        conversation_status: CONVERSATION_STATUS.DRAFT,
        transcript_status: "processing",
        twinai_run_status: TWIN_AI_STATUS.NOT_INITIATED,
      },
      conversationId,
      userId,
    );

    const hasFile = await hasFilePath(
      `${RECORDINGS_FOLDER}/${userId}/${conversationId}`,
      `recording-${conversationId}.webm`,
    );

    if (!hasFile) {
      return NextResponse.json({ message: "File not found" }, { status: 404 });
    }

    const uploadUrl = `${FTP_PUBLIC_URL}/${RECORDINGS_FOLDER}/${userId}/${conversationId}/recording-${conversationId}.webm`;

    // Submit transcription with webhook - returns immediately
    // The webhook runs conversation analysis via LiteLLM in the background
    const transcriptId = await AssemblyAIService.submitTranscriptionWithWebhook(
      uploadUrl,
      conversationId,
      userId,
      getCallbackBaseUrl(req),
    );

    console.log(
      `[Assemble & Process] Transcription submitted for conversation: ${conversationId}, transcript ID: ${transcriptId}`,
    );

    // Return immediately - processing continues via webhook
    return NextResponse.json({
      success: true,
      message: "Transcription submitted. You will be notified when complete.",
      transcriptId,
    });
  } catch (error: any) {
    console.error("[Assemble & Process] Error:", error.message);

    return NextResponse.json(
      { message: error.message || "Processing failed" },
      { status: 500 },
    );
  }
}
