import { UserModel } from "@/app/api/models/user";
import { AssemblyAIService } from "@/app/api/services/assemblyAIService";
import { ConversationService } from "@/app/api/services/conversationService";
import { ConversationAnalysisService } from "@/app/api/services/conversationAnalysisService";
import { CONVERSATION_STATUS, TWIN_AI_STATUS } from "@/configs/constants";
import { NextRequest, NextResponse, after } from "next/server";

export const dynamic = "force-dynamic";

interface AssemblyAIWebhookPayload {
  transcript_id: string;
  status: "completed" | "error";
  text?: string;
  error?: string;
}

/**
 * Webhook endpoint for AssemblyAI transcription callbacks.
 * Called by AssemblyAI when a transcription is completed or fails.
 *
 * NOTE — deliberate rollback (2026-07-22, op verzoek van de opdrachtgever):
 * Deze endpoint had een gedeelde-secret-controle (fail-closed), plus een
 * eigenaars-lookup en een idempotentie-check. Die drie poorten konden de
 * callback stil afwijzen, waardoor de analyse nooit startte. Om terug te keren
 * naar de bewezen werkende situatie zijn ze verwijderd.
 *
 * Gevolg dat je moet kennen: dit endpoint is nu niet geauthenticeerd. Wie de
 * URL kent kan een callback nabootsen en zo een analyse laten draaien op
 * aangeleverde tekst. Wil je die bescherming terug, zet dan
 * ASSEMBLYAI_WEBHOOK_SECRET en herstel de controle — maar let op dat de secret
 * al gezet moet zijn vóórdat een opname wordt INGEDIEND, want hij wordt op dat
 * moment aan AssemblyAI meegegeven.
 */
export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get("conversationId");
    const userId = searchParams.get("userId");

    if (!conversationId || !userId) {
      console.error(
        "[AssemblyAI Webhook] Missing conversationId or userId in query params",
      );
      return NextResponse.json(
        { message: "Missing required query parameters" },
        { status: 400 },
      );
    }

    const payload: AssemblyAIWebhookPayload = await req.json();
    const { transcript_id, status } = payload;

    console.log(
      `[AssemblyAI Webhook] Received callback for conversation: ${conversationId}, transcript: ${transcript_id}, status: ${status}`,
    );

    if (status === "completed") {
      const transcriptText =
        await AssemblyAIService.getTranscriptText(transcript_id);

      console.log(
        `[AssemblyAI Webhook] Transcript received (${transcriptText.length} chars)`,
      );

      // Lege opname (bv. gestart en direct gestopt, of een meeting zonder
      // spraak): AssemblyAI levert dan een leeg transcript. De analyse kan daar
      // niets mee ("gesprek is required and must be a non-empty string") en zou
      // crashen + een alarmerende foutmail sturen. Handel dit netjes af: sla de
      // analyse over en markeer het gesprek als mislukt zonder LLM-call/mail.
      if (!transcriptText || transcriptText.trim().length === 0) {
        console.warn(
          `[AssemblyAI Webhook] Leeg transcript voor ${conversationId} — geen spraak; analyse overgeslagen.`,
        );
        await ConversationService.updateConversationX(
          {
            transcript_status: "completed",
            transcript_text: transcriptText,
            conversation_status: CONVERSATION_STATUS.TWIN_AI_UPLOAD_FAILED,
            twinai_run_status: TWIN_AI_STATUS.FAILED,
          },
          conversationId,
          userId,
        );
        return NextResponse.json({ status: "empty_transcript" });
      }

      await ConversationService.updateConversationX(
        {
          transcript_status: "completed",
          transcript_text: transcriptText,
        },
        conversationId,
        userId,
      );

      const langCode = await UserModel.getUserLangPreference(userId);

      after(async () => {
        try {
          await ConversationAnalysisService.analyzeAndPersist(
            conversationId,
            userId,
            transcriptText,
            langCode,
          );
          console.log(
            `[AssemblyAI Webhook] Conversation analysis completed for: ${conversationId}`,
          );
        } catch (error: any) {
          console.error(
            `[AssemblyAI Webhook] Conversation analysis failed for ${conversationId}:`,
            error?.message || error,
          );
        }
      });

      console.log(
        `[AssemblyAI Webhook] Conversation analysis queued for: ${conversationId}`,
      );

      return NextResponse.json({ status: "success" });
    }

    console.warn(`[AssemblyAI Webhook] Unknown status: ${status}`);
    return NextResponse.json({ status: "unknown_status" });
  } catch (error: any) {
    console.error("[AssemblyAI Webhook] Error:", error.message);
    return NextResponse.json(
      { message: error.message || "Webhook processing failed" },
      { status: 500 },
    );
  }
}
