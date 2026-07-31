import { NextRequest } from "next/server";
import { ConversationController } from "@/app/api/controllers/conversationController";
import { authMiddleware } from "@/app/api/middleware/authMiddleware";
import { USER_ROLE } from "@/configs/constants";
import { types } from "@/app/api/utils/type-constants";

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ conversationId: string }> },
) {
  const searchParams = req.nextUrl.searchParams;
  const type = searchParams.get("type");
  const { conversationId } = await context.params;

  let authCheck, langCode;

  const cookieHeader = req.headers.get("cookie");

  if (cookieHeader) {
    const match = cookieHeader.match(/NEXT_LOCALE=([^;]+)/);

    if (match) {
      langCode = decodeURIComponent(match[1]);
    }
  }

  switch (type) {
    case types.DELETE_CONVERSATION_DRAFT:
      authCheck = await authMiddleware(req);

      if (authCheck) return authCheck;

      return ConversationController.deleteConversationDraft(
        conversationId,
        langCode,
      );
    default:
      authCheck = await authMiddleware(req, USER_ROLE.SUPER_ADMIN);

      if (authCheck) return authCheck;

      return ConversationController.deleteConversation(conversationId);
  }
}
