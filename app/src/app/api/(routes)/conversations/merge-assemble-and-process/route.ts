import { NextRequest, NextResponse, after } from "next/server";
import { Input, BlobSource, ALL_FORMATS } from "mediabunny";
import { ConversationModel } from "@/app/api/models/conversation";
import { ConversationService } from "@/app/api/services/conversationService";
import { AssemblyAIService } from "@/app/api/services/assemblyAIService";
import { buildConversationKeyterms } from "@/app/api/services/terminologyService";
import {
  downloadFileFromFtp,
  listAudioChunks,
  saveFileToFtp,
} from "@/app/api/utils/fileStorage";
import { CONVERSATION_STATUS, TWIN_AI_STATUS } from "@/configs/constants";
import { authMiddleware } from "@/app/api/middleware/authMiddleware";
import { getCallbackBaseUrl } from "@/app/api/utils/requestOrigin";

const FTP_PUBLIC_URL = process.env.FTP_PUBLIC_URL;
const RECORDINGS_FOLDER = process.env.RECORDINGS_FOLDER;

export const maxDuration = 300;
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
        { status: 400 }
      );
    }

    const authenticatedUser = (req as any).user;
    if (!authenticatedUser?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const userId = authenticatedUser.id;

    console.log(
      `[MergeAssembleProcess] Starting for conversation: ${conversationId}`
    );

    const conversation = await ConversationModel.getConversationById(
      conversationId,
      userId,
      false
    );

    if (!conversation) {
      return NextResponse.json(
        { message: "Conversation not found" },
        { status: 404 }
      );
    }

    const chunkFilenames = await listAudioChunks(userId, conversationId);

    if (chunkFilenames.length === 0) {
      return NextResponse.json(
        { message: "No audio chunks found" },
        { status: 404 }
      );
    }

    console.log(
      `[MergeAssembleProcess] Found ${chunkFilenames.length} chunks to process`
    );

    await ConversationService.updateConversationX(
      {
        file_duration: 0,
        conversation_status: CONVERSATION_STATUS.DRAFT,
        transcript_status: "processing",
        twinai_run_status: TWIN_AI_STATUS.NOT_INITIATED,
        is_merging_chunks: true,
      },
      conversationId,
      userId
    );
    // Fire-and-forget: Process everything in background after response is sent
    after(async () => {
      try {
        console.log(
          `[MergeAssembleProcess] Background processing started for: ${conversationId}`
        );

        // Step 1: Sort chunks by timestamp
        const sortedChunks = chunkFilenames.sort((a, b) => {
          const timestampA = parseInt(a.match(/chunk-(\d+)\.webm/)?.[1] || "0");
          const timestampB = parseInt(b.match(/chunk-(\d+)\.webm/)?.[1] || "0");
          return timestampA - timestampB;
        });

        // Step 2: Download all chunks
        const chunkBuffers: Buffer[] = [];
        for (const filename of sortedChunks) {
          const filePath = `${RECORDINGS_FOLDER}/${userId}/${conversationId}/${filename}`;
          console.log(`[MergeAssembleProcess] Downloading: ${filename}`);
          const buffer = await downloadFileFromFtp(filePath);
          chunkBuffers.push(buffer);
        }

        // Step 3: Merge chunks
        const combinedBuffer = Buffer.concat(chunkBuffers);
        console.log(
          `[MergeAssembleProcess] Combined ${chunkBuffers.length} chunks, total size: ${combinedBuffer.length} bytes`
        );

        // Step 4: Compute duration
        const blob = new Blob([combinedBuffer], { type: "audio/webm" });
        const input = new Input({
          source: new BlobSource(blob),
          formats: ALL_FORMATS,
        });
        const durationInSeconds = await input.computeDuration();

        // Step 5: Save merged file to FTP
        const fileName = `recording-${conversationId}.webm`;
        const relativeFolder = `${RECORDINGS_FOLDER}/${userId}/${conversationId}`;
        const savedPath = await saveFileToFtp(
          combinedBuffer.buffer,
          fileName,
          relativeFolder
        );
        console.log(
          `[MergeAssembleProcess] Saved merged file to: ${savedPath}`
        );

        // Step 6: Update conversation status to processing
        await ConversationService.updateConversationX(
          {
            file_duration: durationInSeconds,
            is_merging_chunks: false,
          },
          conversationId,
          userId
        );

        // Step 7: Submit transcription to AssemblyAI
        const uploadUrl = `${FTP_PUBLIC_URL}/${RECORDINGS_FOLDER}/${userId}/${conversationId}/recording-${conversationId}.webm`;
        const transcriptId =
          await AssemblyAIService.submitTranscriptionWithWebhook(
            uploadUrl,
            conversationId,
            userId,
            getCallbackBaseUrl(req),
            await buildConversationKeyterms(userId)
          );

        console.log(
          `[MergeAssembleProcess] Transcription submitted for conversation: ${conversationId}, transcript ID: ${transcriptId}`
        );

        console.log(
          `[MergeAssembleProcess] Background processing completed for: ${conversationId}`
        );
      } catch (error) {
        console.error(
          `[MergeAssembleProcess] Background processing failed for ${conversationId}:`,
          error
        );
      }
    });

    // Return immediately - processing continues in background
    return NextResponse.json({
      success: true,
      processing: true,
      message: "Processing started in background",
      chunksCount: chunkFilenames.length,
    });
  } catch (error: any) {
    console.error("[MergeAssembleProcess] Error:", error.message);
    return NextResponse.json(
      { message: error.message || "Processing failed" },
      { status: 500 }
    );
  }
}
