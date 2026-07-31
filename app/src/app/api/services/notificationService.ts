import {
  NOTIFICATION_REFERENCE_TYPE,
  NOTIFICATION_TYPE,
} from "@/configs/constants";
import { prisma } from "../utils/prisma";
import { NextRequest } from "next/server";
import { NotificationModel } from "../models/notification";

export const NotificationService = {
  async createEvaluationNotification(conversationId: string) {
    try {
      // Fetch conversation details
      const conversation = await prisma.userConversation.findUnique({
        where: { id: conversationId },
        include: {
          user: { include: { manager: true } },
          customer: true,
        },
      });

      if (!conversation || !conversation.user || !conversation.customer) {
        console.error(
          `❌ Conversation or related entities not found for ID: ${conversationId}`
        );
        return;
      }

      const message = `Evaluation completed with ${conversation.customer.name}`;

      const notifications = [
        {
          user_id: conversation.user.id, // Conversation owner
          type: NOTIFICATION_TYPE.CONVERSATION,
          message,
          reference_id: conversationId,
          reference_type: NOTIFICATION_REFERENCE_TYPE.CONVERSATIONS,
        },
      ];

      // Add notification for the manager if exists
      if (conversation.user.manager) {
        notifications.push({
          user_id: conversation.user.manager.id, // Manager
          type: NOTIFICATION_TYPE.CONVERSATION,
          message: `Evaluation completed for ${conversation.user.name} with ${conversation.customer.name}`,
          reference_id: conversationId,
          reference_type: NOTIFICATION_REFERENCE_TYPE.CONVERSATIONS,
        });
      }

      // Save notifications in DB
      await prisma.notification.createMany({ data: notifications });
    } catch (error) {
      console.error("❌ Error creating notifications:", error);
    }
  },

  async getNotifications(
    req: NextRequest,
    teamNotifications?: boolean,
    userId: string | null
  ) {
    try {
      if (userId) {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          include: { role: true },
        });

        if (!user) {
          throw new Error("User not found.");
        }
      }

      return await NotificationModel.getUserNotifications(
        req,
        teamNotifications,
        userId
      );
    } catch (error: any) {
      throw new Error(error?.message || "Error getting user profile.");
    }
  },
};
