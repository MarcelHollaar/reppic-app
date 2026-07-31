import { NextRequest, NextResponse, after } from "next/server";
import { Input, BlobSource, ALL_FORMATS } from "mediabunny";
import { ConversationModel } from "../../models/conversation";
import {
  downloadFileFromFtp,
  listAudioChunks,
  saveFileToFtp,
} from "../../utils/fileStorage";
import { ConversationService } from "../../services/conversationService";
import { CONVERSATION_STATUS } from "@/configs/constants";
import { authMiddleware } from "../../middleware/authMiddleware";

export const maxDuration = 300;
export const dynamic = "force-dynamic";
const RECORDINGS_FOLDER = process.env.RECORDINGS_FOLDER;

export async function POST(req: NextRequest) {
  const authCheck = await authMiddleware(req);
  if (authCheck) return authCheck;
  const requester = (req as any).user;

  const { conversationId } = await req.json();

  if (!conversationId) {
    return NextResponse.json(
      { message: "conversationId is required" },
      { status: 400 }
    );
  }

  const conversation = await ConversationModel.getConversationById(
    conversationId,
    "",
    false
  );

  // Only the owner (or superadmin) may merge a conversation's chunks.
  if (
    conversation &&
    conversation.user_id !== requester?.id &&
    requester?.role?.name !== "superadmin"
  ) {
    return NextResponse.json(
      { message: "Conversation not found" },
      { status: 404 }
    );
  }

  if (!conversation) {
    return NextResponse.json(
      { message: "Conversation not found" },
      { status: 404 }
    );
  }

  const userId = conversation.user_id;
  const chunkFilenames = await listAudioChunks(userId, conversationId);

  if (chunkFilenames.length === 0) {
    return NextResponse.json(
      { message: "No audio chunks found" },
      { status: 404 }
    );
  }

  console.log(`[MergeChunks] Found ${chunkFilenames.length} chunks to merge`);

  await ConversationService.updateConversationX(
    {
      is_merging_chunks: true,
    },
    conversation.id,
    userId
  );

  // Fire-and-forget: Process in background after response is sent
  after(async () => {
    try {
      console.log(
        `[MergeChunks] Background processing started for: ${conversationId}`
      );

      // Sort chunks by timestamp
      const sortedChunks = chunkFilenames.sort((a, b) => {
        const timestampA = parseInt(a.match(/chunk-(\d+)\.webm/)?.[1] || "0");
        const timestampB = parseInt(b.match(/chunk-(\d+)\.webm/)?.[1] || "0");
        return timestampA - timestampB;
      });

      // Download all chunks
      const chunkBuffers: Buffer[] = [];

      for (const filename of sortedChunks) {
        const filePath = `${RECORDINGS_FOLDER}/${userId}/${conversationId}/${filename}`;
        console.log(`[MergeChunks] Downloading: ${filename}`);
        const buffer = await downloadFileFromFtp(filePath);
        chunkBuffers.push(buffer);
      }

      const combinedBuffer = Buffer.concat(chunkBuffers);

      console.log(
        `[MergeChunks] Combined ${chunkBuffers.length} chunks, total size: ${combinedBuffer.length} bytes`
      );

      const blob = new Blob([combinedBuffer], { type: "audio/webm" });
      const input = new Input({
        source: new BlobSource(blob),
        formats: ALL_FORMATS,
      });

      const durationInSeconds = await input.computeDuration();

      const fileName = `recording-${conversationId}.webm`;
      const relativeFolder = `${RECORDINGS_FOLDER}/${userId}/${conversationId}`;
      const savedPath = await saveFileToFtp(
        combinedBuffer.buffer,
        fileName,
        relativeFolder
      );

      console.log(`[MergeChunks] Saved merged file to: ${savedPath}`);

      await ConversationService.updateConversationX(
        {
          file_duration: durationInSeconds,
          conversation_status: CONVERSATION_STATUS.DRAFT,
          is_merging_chunks: false,
        },
        conversation.id,
        userId
      );

      console.log(
        `[MergeChunks] Background processing completed for: ${conversationId}`
      );
    } catch (error) {
      console.error(
        `[MergeChunks] Background processing failed for ${conversationId}:`,
        error
      );
    }
  });

  // Return immediately - processing continues in background
  return NextResponse.json({
    success: true,
    processing: true,
    message: "Merge started in background",
    chunksCount: chunkFilenames.length,
  });
}
