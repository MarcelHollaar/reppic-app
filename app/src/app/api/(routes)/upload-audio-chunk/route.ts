import { NextRequest, NextResponse } from "next/server";
import { saveAudioChunkToFtp } from "../../utils/fileStorage";
import { getUserId } from "./simpleAuthMiddleware";

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // Auth check
    const userId = getUserId(req);
    
    const formData = await req.formData();
    
    const audio = formData.get("audio") as File;
    const conversationId = formData.get("conversationId") as string;
    
    if (!audio) {
      return NextResponse.json(
        { message: "Missing audio chunk" },
        { status: 400 }
      );
    }

    // conversationId is now required - must be initialized before uploading chunks
    if (!conversationId) {
      return NextResponse.json(
        { message: "conversationId is required" },
        { status: 400 }
      );
    }

    console.log(`[UploadAudioChunk] User ${userId}, Conversation ${conversationId}, Chunk size: ${audio.size} bytes`);

    const buffer = Buffer.from(await audio.arrayBuffer());
    const fileName = audio.name || `${Date.now()}.webm`;
    
    const savedPath = await saveAudioChunkToFtp(buffer, fileName, userId, conversationId);

    return NextResponse.json({
      success: true,
      conversationId: conversationId,
      path: savedPath,
      message: "Audio chunk uploaded successfully"
    });

  } catch (error: any) {
    console.error("[UploadAudioChunk] Error:", error);
    return NextResponse.json(
      { message: error.message || "Audio chunk upload failed" },
      { status: 500 }
    );
  }
}

