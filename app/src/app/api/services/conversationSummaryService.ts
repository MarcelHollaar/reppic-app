import { prisma } from "../utils/prisma";

export interface CreateConversationSummaryData {
  conversation_id: string;
  transcribed_text: string;
  learning_points?: string[];
  mail_text: string;
  summary_text: string;
  resistance_text: string;
  salesperson_percentage: number | null;
  atmosphere: string;
  total_score: number;
  phases: any;
  resistances?: any;
  customer_type: string;
  geen_salesgesprek?: boolean;
}

export const ConversationSummaryService = {
  async create(data: CreateConversationSummaryData) {
    return await prisma.conversationSummaryX.create({
      data: {
        conversation_id: data.conversation_id,
        transcribed_text: data.transcribed_text || null,
        learning_points: data.learning_points || [],
        mail_text: data.mail_text || null,
        summary_text: data.summary_text || null,
        resistance_text: data.resistance_text || null,
        salesperson_percentage: data.salesperson_percentage ?? null,
        atmosphere: data.atmosphere || null,
        total_score: data.total_score ?? null,
        phases: data.phases || null,
        resistances: data.resistances || null,
        customer_type: data.customer_type || null,
        geen_salesgesprek: data.geen_salesgesprek ?? false,
      },
    });
  },

  async findById(id: string) {
    return await prisma.conversationSummaryX.findUnique({
      where: { id },
      include: {
        user_conversation: {
          include: {
            user: true,
            customer: true,
          },
        },
      },
    });
  },

  async findByConversationId(conversationId: string) {
    return await prisma.conversationSummaryX.findMany({
      where: {
        conversation_id: conversationId,
      },
      orderBy: {
        created_at: "desc",
      },
    });
  },

  async delete(id: string) {
    return await prisma.conversationSummaryX.delete({
      where: { id },
    });
  },
};
