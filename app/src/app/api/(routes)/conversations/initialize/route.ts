import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "../../upload-audio-chunk/simpleAuthMiddleware";
import { ConversationModel } from "../../../models/conversation";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    // Auth check - get userId from JWT token
    const userId = getUserId(req);

    console.log(
      `[InitializeConversation] Creating empty conversation for user ${userId}`
    );

    // Create empty conversation with only user_id and twinai_run_status
    const newConversation = await ConversationModel.createConversation({
      user_id: userId,
    });

    console.log(
      `[InitializeConversation] Created conversation: ${newConversation.id}`
    );

    return NextResponse.json(
      {
        success: true,
        conversationId: newConversation.id,
        message: "Conversation initialized successfully",
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[InitializeConversation] Error:", error);

    // Handle auth errors specifically
    if (
      error.message?.includes("Unauthorized") ||
      error.message?.includes("Authentication failed")
    ) {
      return NextResponse.json(
        { message: error.message || "Unauthorized" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { message: error.message || "Failed to initialize conversation" },
      { status: 500 }
    );
  }
}
