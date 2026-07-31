import { NextRequest, NextResponse } from "next/server";
import { authMiddleware } from "../../../middleware/authMiddleware";
import { TempFileService } from "../../../services/tempFileService";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const authCheck = await authMiddleware(req);
  if (authCheck) return authCheck;

  try {
    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get("conversationId");
    const expectedCount = parseInt(searchParams.get("expectedCount") || "0");

    if (!conversationId) {
      return NextResponse.json(
        { message: "Missing conversationId" },
        { status: 400 }
      );
    }

    const chunkCount = await TempFileService.getChunkCount(conversationId);
    
    // Consider chunks exist if we have at least some chunks (real-time upload may not have all yet)
    // For assembly, we need the exact count, but for checking if real-time upload worked,
    // we just need to know if any chunks exist
    const exists = chunkCount > 0;

    return NextResponse.json({
      exists,
      chunkCount,
      expectedCount,
      // If we have chunks but not the full count, they might still be uploading
      isComplete: expectedCount > 0 && chunkCount >= expectedCount,
    });

  } catch (error: any) {
    console.error("[CheckChunks] Error:", error);
    return NextResponse.json(
      { message: error.message || "Failed to check chunks" },
      { status: 500 }
    );
  }
}

