import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../utils/prisma";
import { mailService } from "../services/mailService";
import { NotificationService } from "../services/notificationService";

export class WebhookController {
  static async handleWebhook(req: NextRequest) {
    try {
      const body = await req.json();
      console.log("📧 Received webhook:", body); // loggin tthe webhook

      return NextResponse.json(
        {
          message:
            "Conversation summary saved and notifications sent successfully",
        },
        { status: 200 }
      );

      const {
        conversation_id,
        Titel,
        Totaalscore,
        AantalGesteldeVragen,
        PercentageVerkoper,
        Fases,
        Doc,
        Klanttype,
      } = body;

      if (!conversation_id) {
        console.error("❌ Missing conversation_id in webhook payload.");
        return NextResponse.json(
          { message: "conversation_id is required" },
          { status: 400 }
        );
      }

      // Fetch the conversation with related user and customer details
      const conversation = await prisma.userConversation.findUnique({
        where: { id: conversation_id },
        include: {
          user: {
            include: {
              manager: true,
              user_settings: true,
            },
          },
          customer: true,
        },
      });

      if (!conversation) {
        console.error(`❌ Conversation with ID ${conversation_id} not found.`);
        return NextResponse.json(
          { message: "Conversation not found" },
          { status: 404 }
        );
      }
      const questionsAsked = AantalGesteldeVragen || 0;
      const data = {
        conversation_id,
        title: Titel,
        customer_type: Klanttype || "N/A",
        phases: Fases,
        score: parseFloat(Totaalscore),
        salesperson_speak_percentage: parseFloat(PercentageVerkoper),
        questions_asked: parseInt(questionsAsked),
        summary: body.Samenvatting,
        learning_points: body.Leerpunten,
        custom_data: {
          docId: Doc?.id || null,
          docName: Doc?.originalName || null,
          fileType: Doc?.extension || null,
          resistors: body?.Weerstanden || null,
        },
      };

      // Save the conversation summary in the database
      const newSummary = await prisma.conversationSummary.create({
        data: data,
      });

      if (newSummary) {
        await NotificationService.createEvaluationNotification(conversation_id);
      }

      await prisma.userConversation.update({
        where: { id: conversation.id },
        data: {
          evaluated_at: new Date(), // updated evaluated_at timestamp
        },
      });

      // Send email to the user
      await this.sendUserNotification(conversation);

      // Send email to the manager
      await this.sendManagerNotification(conversation);

      return NextResponse.json(
        {
          message:
            "Conversation summary saved and notifications sent successfully",
        },
        { status: 200 }
      );
    } catch (error) {
      console.error("❌ Error processing webhook:", error);
      return NextResponse.json(
        { message: "Internal Server Error" },
        { status: 500 }
      );
    }
  }

  private static async sendUserNotification(conversation: any) {
    const user = conversation.user;

    // Check user notification settings
    const notificationSettings = user.user_settings[0]?.notification_setting;
    const canSendReminders = notificationSettings?.reminders?.email ?? true;

    if (canSendReminders) {
      await mailService.sendEvaluationEmailToUser(
        conversation,
        user?.lang_code || "en"
      );
    }
  }

  private static async sendManagerNotification(conversation: any) {
    const user = conversation.user;
    const manager = user.manager;

    if (manager) {
      // Fetch manager's user settings to check notification preferences
      const managerSettings = await prisma.userSetting.findFirst({
        where: { user_id: manager.id },
      });

      // Check if manager has notification settings for team member evaluations
      const canSendManagerReminders =
        managerSettings?.notification_setting?.reminders?.email ?? true;

      if (canSendManagerReminders) {
        await mailService.sendEvaluationEmailToManager(
          conversation,
          manager?.lang_code || "en"
        );
      }
    }
  }
}
