import { NextRequest, NextResponse } from "next/server";
import { ConversationModel } from "../../models/conversation";
import { deleteConversationDirectory } from "../../utils/fileStorage";
import { ConversationService } from "../../services/conversationService";
import { authMiddleware } from "../../middleware/authMiddleware";
import { prisma } from "../../utils/prisma";

export const dynamic = "force-dynamic";

export async function DELETE(req: NextRequest) {
  try {
    const authCheck = await authMiddleware(req);
    if (authCheck) return authCheck;
    const requester = (req as any).user;

    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get("conversationId");

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

    if (!conversation) {
      return NextResponse.json(
        { message: "Conversation not found" },
        { status: 404 }
      );
    }

    const userId = conversation.user_id;

    // Destructive: only the owner, a same-company manager, or superadmin may
    // delete a conversation's recording chunks.
    const role = requester?.role?.name;
    let allowed = userId === requester?.id || role === "superadmin";
    if (!allowed && role === "manager") {
      const owner = await prisma.user.findUnique({
        where: { id: userId },
        select: { company_id: true },
      });
      allowed = Boolean(
        owner?.company_id &&
          requester?.company_id &&
          owner.company_id === requester.company_id,
      );
    }
    if (!allowed) {
      return NextResponse.json(
        { message: "Conversation not found" },
        { status: 404 }
      );
    }

    await deleteConversationDirectory(userId, conversationId);

    if (!conversation.title) {
      await ConversationService.updateConversationX(
        {
          conversation_status: null,
          file_duration: 0,
        },
        conversationId,
        userId
      );
    }

    return NextResponse.json(
      { message: "Chunks deleted successfully" },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[DeleteChunks] Error:", error);
    return NextResponse.json(
      { message: error.message || "Failed to delete chunks" },
      { status: 500 }
    );
  }
}
