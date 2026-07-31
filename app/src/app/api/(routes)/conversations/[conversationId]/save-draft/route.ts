import { NextRequest, NextResponse } from "next/server";
import { authMiddleware } from "@/app/api/middleware/authMiddleware";
import { ConversationService } from "@/app/api/services/conversationService";
import { CONVERSATION_STATUS } from "@/configs/constants";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ conversationId: string }> }
) {
  try {
    const authCheck = await authMiddleware(req);
    if (authCheck) return authCheck;

    const user = (req as any).user;

    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { conversationId } = await context.params;
    const body = await req.json();

    const updateData = {
      ...body,
      conversation_status: CONVERSATION_STATUS.DRAFT,
    };

    const conversation = await ConversationService.updateConversationX(
      updateData,
      conversationId,
      user.id
    );

    return NextResponse.json(
      {
        message: "Conversation draft saved successfully",
        data: conversation,
      },
      { status: 200 }
    );
  } catch (error: any) {
    const status = error.message === "Conversation not found." ? 404 : 400;
    return NextResponse.json(
      { message: error.message || "Failed to save conversation draft" },
      { status }
    );
  }
}
