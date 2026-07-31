import { NextRequest, NextResponse } from "next/server";
import { authMiddleware } from "../../../middleware/authMiddleware";
import { TempFileService } from "../../../services/tempFileService";

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const authCheck = await authMiddleware(req);
  if (authCheck) return authCheck;

  try {
    const formData = await req.formData();
    
    const chunk = formData.get("chunk") as File;
    const chunkIndex = parseInt(formData.get("chunkIndex") as string);
    const totalChunks = parseInt(formData.get("totalChunks") as string);
    const conversationId = formData.get("conversationId") as string;
    
    if (!chunk || isNaN(chunkIndex) || isNaN(totalChunks) || !conversationId) {
      return NextResponse.json(
        { message: "Missing required fields" },
        { status: 400 }
      );
    }

    console.log(`[UploadChunk] Received chunk ${chunkIndex + 1}/${totalChunks} for conversation ${conversationId} (size: ${chunk.size} bytes)`);

    const buffer = Buffer.from(await chunk.arrayBuffer());
    await TempFileService.saveChunk(
      conversationId,
      chunkIndex,
      buffer
    );

    const isLastChunk = chunkIndex === totalChunks - 1;

    return NextResponse.json({
      success: true,
      chunkIndex,
      isLastChunk,
      message: isLastChunk 
        ? "All chunks received, ready for assembly" 
        : `Chunk ${chunkIndex + 1}/${totalChunks} received`
    });

  } catch (error: any) {
    console.error("[UploadChunk] Error:", error);
    return NextResponse.json(
      { message: error.message || "Chunk upload failed" },
      { status: 500 }
    );
  }
}
