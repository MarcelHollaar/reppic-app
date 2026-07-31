import { USER_ROLE } from "@/configs/constants";
import { NextRequest, NextResponse } from "next/server";
import { ConversationService } from "../services/conversationService";

export class ConversationController {
  static async getConversations(req: NextRequest, teamConversations?: boolean) {
    try {
      const user = (req as any).user;
      if (!user) {
        return NextResponse.json(
          { message: "Unauthorized User." },
          { status: 401 }
        );
      }

      const { searchParams } = new URL(req.url);
      const userId = searchParams.get("user_id");
      const superAdminConversations = user.role.name === USER_ROLE.SUPER_ADMIN;
      let targetUserId: string | null = user.id; // Default to logged-in user

      if (teamConversations) {
        if (userId) {
          // If user_id is provided, fetch conversations for that user
          targetUserId = userId;
        } else {
          // If no user_id, set null to indicate fetching all team conversations
          targetUserId = null;
        }
      }

      const conversations = await ConversationService.getConversations(
        req,
        targetUserId,
        superAdminConversations,
        teamConversations
      );
      return NextResponse.json(
        { message: "Conversations fetched", data: conversations },
        { status: 200 }
      );
    } catch (error: any) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }
  }

  static async getConversationById(id: string, req: NextRequest) {
    try {
      const user = (req as any).user;
      if (!user) {
        return NextResponse.json(
          { message: "Unauthorized User." },
          { status: 401 }
        );
      }

      const conversation = await ConversationService.getConversationById(
        id,
        user.id
      );
      if (!conversation) {
        return NextResponse.json(
          { message: "Conversation not found." },
          { status: 404 }
        );
      }

      return NextResponse.json(
        { message: "Conversation fetched", data: conversation },
        { status: 200 }
      );
    } catch (error: any) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }
  }

  /**
   * Deletes a conversation by its ID.
   *
   * @param {string} conversationId - ID of the conversation to delete.
   * @returns {Promise<NextResponse>} - A response indicating the result of the deletion.
   */
  static async deleteConversation(conversationId: string) {
    try {
      const conversation = await ConversationService.deleteConversation(
        conversationId
      );

      return NextResponse.json(
        { message: "Conversation deleted", conversation },
        { status: 201 }
      );
    } catch (error: any) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
  }

  static async deleteConversationDraft(
    conversationId: string,
    langCode?: string
  ) {
    try {
      const conversation = await ConversationService.deleteConversationDraft(
        conversationId,
        langCode
      );
      return NextResponse.json(
        { message: "Conversation deleted", conversation },
        { status: 201 }
      );
    } catch (error: any) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
  }

  static async getAudioFile(filePath: string, req: NextRequest) {
    try {
      const user = (req as any).user;
      if (!user) {
        return NextResponse.json(
          { message: "Unauthorized User." },
          { status: 401 }
        );
      }
      const { arrayBuffer: fileStream, contentType } =
        await ConversationService.getAudioFileStream(filePath);
      if (!fileStream) {
        return NextResponse.json(
          { message: "File not found." },
          { status: 404 }
        );
      }
      return new NextResponse(fileStream, {
        status: 200,
        headers: {
          "Content-Type":
            contentType === "application/octet-stream"
              ? "video/mp4;codecs=mp4a.40.2"
              : contentType,
        },
      });
    } catch (error: any) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }
  }

  static async getConversationStatuses(req: NextRequest, deviceId?: string) {
    try {
      const user = (req as any).user;
      if (!user) {
        return NextResponse.json(
          { message: "Unauthorized User." },
          { status: 401 }
        );
      }
      const statuses = await ConversationService.getConversationStatuses(
        user.id,
        deviceId
      );
      return NextResponse.json(
        { message: "Statuses fetched", data: statuses },
        { status: 200 }
      );
    } catch (error: any) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }
  }
}
