import { NextRequest, NextResponse } from "next/server";
import { ConversationController } from "../../controllers/conversationController";
import { authMiddleware } from "../../middleware/authMiddleware";
import { ConversationService } from "../../services/conversationService";
import { hasFilePath, listAudioChunks } from "../../utils/fileStorage";
import { types } from "../../utils/type-constants";
import { canAccessConversation } from "../../utils/conversationAccess";

export async function GET(req: NextRequest) {
  const authCheck = await authMiddleware(req);
  if (authCheck) return authCheck;

  const user = (req as any).user;

  const searchParams = req.nextUrl.searchParams;
  const type = searchParams.get("type");
  const id = searchParams.get("id");
  const filePath = searchParams.get("file_path");
  const deviceId = searchParams.get("deviceId");
  const { FTP_PUBLIC_URL, RECORDINGS_FOLDER } = process.env;

  switch (type) {
    case types.GET_ALL_CONVERSATIONS:
      return ConversationController.getConversations(req);
    case types.GET_TEAM_CONVERSATIONS:
      return ConversationController.getConversations(req, true);
    case types.GET_CONVERSATIONS:
      if (!id) {
        return new Response("Conversation ID is required", { status: 400 });
      }

      const hasRecording = await hasFilePath(
        `${RECORDINGS_FOLDER}/${user.id}/${id}`,
        `recording-${id}.webm`
      );

      const chunks = await listAudioChunks(user.id, id);
      const hasChunks = chunks.length > 0;

      // Fetch unscoped, then authorize: owner, same-company manager, or
      // superadmin. Prevents reading another user's conversation by id (IDOR).
      const conversation = await ConversationService.getConversationById(id, "");
      if (
        !conversation ||
        !(await canAccessConversation(conversation.user_id, user))
      ) {
        return NextResponse.json(
          { message: "Conversation not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        data: {
          ...conversation,
          hasRecording,
          sourceFileUrl: hasRecording
            ? `${FTP_PUBLIC_URL}/${RECORDINGS_FOLDER}/${user.id}/${id}/recording-${id}.webm`
            : null,
          hasChunks,
        },
      });

    case types.GET_AUDIO_FILE:
      if (!filePath) {
        return new Response("File path is required", { status: 400 });
      }
      return ConversationController.getAudioFile(filePath, req);
    case types.CONVERSATION_STATUSES:
      return ConversationController.getConversationStatuses(req, deviceId);
    default:
      return new Response("Invalid request type", { status: 400 });
  }
}
