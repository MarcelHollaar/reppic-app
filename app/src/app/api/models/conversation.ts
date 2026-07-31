import { CONVERSATION_STATUS } from "@/configs/constants";
import { prisma } from "../utils/prisma";
import { NextRequest } from "next/server";
import { getFullUrl } from "../utils/urlHelper";

interface ConversationFilters {
  start_date?: string;
  end_date?: string;
  date?: string;
  search?: string;
  score_gte?: string;
  score_lte?: string;
  sort_by?: "company_name" | "user_name" | "customer_name";
  sort_order?: "asc" | "desc";
}

export class ConversationModel {
  /**
   * Gets conversations for a given user, team, or all users, based on the parameters.
   *
   * @param req The NextRequest object.
   * @param teamConversations If true, fetches conversations for the user's team.
   * @param userId The ID of the user to fetch conversations for.
   * @param superAdminConversations If true, fetches conversations for all users.
   * @returns A promise that resolves to an object containing the records and pagination information.
   */
  static async getUserConversations(
    req: NextRequest,
    teamConversations: boolean = false,
    userId: string | null,
    superAdminConversations: boolean = false
  ) {
    const searchParams = req.nextUrl.searchParams;
    const getAll = searchParams.get("getAll") === "true";
    if (getAll) {
      const records = await prisma.userConversation.findMany({
        where: {
          user_id: userId, // Only fetch conversations for this user
          conversation_status: {
            not: null,
            in: [
              CONVERSATION_STATUS.FILE_UPLOAD_FAILED,
              CONVERSATION_STATUS.TWIN_AI_UPLOAD_FAILED,
            ],
          },
        },
        include: {
          customer: true,
          user: {
            include: {
              company: {
                select: { title: true },
              },
            },
          },
          conversation_summaries: true,
          conversation_summaries_x: true,
        },
        orderBy: { created_at: "desc" },
      });
      const enhancedRecords = records.map((record) => {
        if (record.user?.avatar) {
          record.user.avatar = getFullUrl(record.user.avatar);
        }
        return superAdminConversations
          ? {
              ...record,
              companyName: record.user?.company?.name || null,
            }
          : record;
      });
      return { records: enhancedRecords };
    }
    const filters: ConversationFilters = {
      start_date: searchParams.get("start_date") || undefined,
      end_date: searchParams.get("end_date") || undefined,
      date: searchParams.get("date") || undefined,
      search: searchParams.get("search") || undefined,
      score_gte: searchParams.get("score_gte") || undefined,
      score_lte: searchParams.get("score_lte") || undefined,
      sort_by:
        (searchParams.get("sort_by") as
          | "company_name"
          | "user_name"
          | "customer_name"
          | "score") || undefined,
      sort_order: (searchParams.get("sort_order") as "asc" | "desc") || "asc",
    };

    const page = parseInt(searchParams.get("page") || "1");
    const per_page = parseInt(searchParams.get("per_page") || "10");
    const skip = (page - 1) * per_page;

    let whereClause: any = {};
    let includeOptions: any = {
      customer: true,
      user: {
        include: {
          company: {
            select: { title: true },
          },
        },
      },
      conversation_summaries: true,
      conversation_summaries_x: true,
    };
    let orderByClause: any = { created_at: "desc" };

    if (!superAdminConversations) {
      const userIds = await this.getUserIdsForFilter(
        req,
        teamConversations,
        userId
      );
      whereClause.user_id = { in: userIds };
    } else {
      includeOptions.user = {
        include: {
          company: {
            select: { title: true },
          },
        },
      };
    }

    // Filter out null conversation_status
    whereClause.conversation_status = { not: null };

    this.applyDateFilters(filters, whereClause);
    this.applySearchFilter(filters, whereClause);
    this.applyScoreFilter(filters, whereClause);
    orderByClause = this.applySorting(filters, orderByClause);

    const totalRecords = await prisma.userConversation.count({
      where: whereClause,
    });

    const records = await prisma.userConversation.findMany({
      where: whereClause,
      include: includeOptions,
      orderBy: orderByClause,
      skip: skip,
      take: per_page,
    });

    const enhancedRecords = records.map((record) => {
      if (record.user?.avatar) {
        record.user.avatar = getFullUrl(record.user.avatar);
      }

      return superAdminConversations
        ? {
            ...record,
            companyName: record.user?.company?.name || null,
          }
        : record;
    });

    return {
      records: enhancedRecords,
      pagination: {
        page,
        per_page,
        total_records: totalRecords,
        total_pages: Math.ceil(totalRecords / per_page),
      },
    };
  }

  private static async getUserIdsForFilter(
    req: NextRequest,
    teamConversations: boolean,
    userId: string | null
  ): Promise<string[]> {
    if (teamConversations) {
      if (userId) {
        return [userId];
      } else {
        const user = (req as any).user;
        const teamMembers = await prisma.user.findMany({
          where: { manager_id: user?.id },
          select: { id: true },
        });
        return [user.id, ...teamMembers.map((member) => member.id)];
      }
    } else {
      return [userId!];
    }
  }

  private static applyDateFilters(
    filters: ConversationFilters,
    whereClause: any
  ) {
    if (filters.start_date || filters.end_date) {
      whereClause.meeting_date = {};
      if (filters.start_date) {
        const startDate = new Date(filters.start_date + "T00:00:00.000Z");
        if (!isNaN(startDate.getTime())) {
          whereClause.meeting_date.gte = startDate;
        }
      }
      if (filters.end_date) {
        const endDate = new Date(filters.end_date + "T23:59:59.999Z");
        if (!isNaN(endDate.getTime())) {
          whereClause.meeting_date.lte = endDate;
        }
      }
    }
  }

  private static applySearchFilter(
    filters: ConversationFilters,
    whereClause: any
  ) {
    if (filters.search) {
      whereClause.OR = [
        { title: { contains: filters.search, mode: "insensitive" } },
        {
          customer: { name: { contains: filters.search, mode: "insensitive" } },
        },
        { user: { name: { contains: filters.search, mode: "insensitive" } } },
        {
          user: {
            company: {
              title: { contains: filters.search, mode: "insensitive" },
            },
          },
        },
      ];
    }
  }

  private static applyScoreFilter(
    filters: ConversationFilters,
    whereClause: any
  ) {
    if (filters.score_gte !== undefined || filters.score_lte !== undefined) {
      whereClause.conversation_summaries = {
        some: {
          score: {} as any,
        },
      };
      if (filters.score_gte !== undefined) {
        whereClause.conversation_summaries.some.score.gte = parseFloat(
          filters.score_gte
        );
      }
      if (filters.score_lte !== undefined) {
        whereClause.conversation_summaries.some.score.lte = parseFloat(
          filters.score_lte
        );
      }
    }
  }

  private static applySorting(
    filters: ConversationFilters,
    orderByClause: any
  ): any {
    if (filters.sort_by) {
      const sortOrder = filters.sort_order === "desc" ? "desc" : "asc";
      switch (filters.sort_by) {
        case "company_name":
          return { user: { company: { title: sortOrder } } };
        case "user_name":
          return { user: { name: sortOrder } };
        case "customer_name":
          return { customer: { name: sortOrder } };
        case "score":
          return { conversation_summaries: { score: sortOrder } };
        default:
          return orderByClause;
      }
    }
    return orderByClause;
  }

  /**
   * Creates a new conversation.
   *
   * @param {object} data - Data of the conversation to be created.
   * @returns {Promise<object>} - Created conversation object.
   */
  static async createConversation(data: any) {
    return prisma.userConversation.create({
      data: {
        user_id: data?.user_id || null,
        customer_id: data?.customer_id || null,
        title: data?.title || null,
        meeting_date: new Date(),
        meeting_time_start: data?.meeting_time_start || null,
        meeting_time_end: data?.meeting_time_end || null,
        file_path: data?.file_path || null,
        file_duration: data?.file_duration || null,
        notes: data?.notes || null,
        twinai_run_id: data?.twinai_run_id || null,
        twinai_run_status: data.twinai_run_status,
        from_device_id: data?.deviceId || data?.from_device_id || null,
        transcript_text: data?.transcript_text ?? null,
        transcript_status: data?.transcript_status ?? undefined,
        transcription_provider: data?.transcription_provider ?? undefined,
        audio_retention_until: data?.audio_retention_until ?? null,
      },
    });
  }

  /**
   * Retrieves a conversation by its ID.
   *
   * @param {string} conversationId - ID of the conversation to retrieve.
   * @param {string} userId - ID of the user who is retrieving the conversation.
   * @returns {Promise<object>} - Retrieved conversation object.
   */
  static async getConversationById(
    conversationId: string,
    userId: string,
    getFullPath = true
  ) {
    // Ownership scoping: when a userId is given, only return the conversation
    // if it belongs to that user. Callers that must authorize across users
    // (owner / same-company manager / superadmin) pass an empty userId and run
    // their own check (see canAccessConversation). Previously userId was
    // ignored entirely, which let any authenticated user read/modify any
    // conversation by id (IDOR).
    const conversation = await prisma.userConversation.findFirst({
      where: {
        id: conversationId,
        ...(userId ? { user_id: userId } : {}),
      },
      include: {
        customer: true,
        conversation_summaries: true,
        conversation_summaries_x: true,
      },
    });
    if (!conversation) return null;
    // Attach full file URL if file_path exists
    if (conversation.file_path && getFullPath) {
      conversation.file_path = getFullUrl(conversation.file_path, true);
    }

    return conversation;
  }

  static async getConversationSummaryXById(conversationId: string) {
    return prisma.conversationSummaryX.findFirst({
      where: {
        conversation_id: conversationId,
      },
      include: {
        user_conversation: true,
      },
    });
  }

  /**
   * Deletes a conversation by its ID.
   * This method also deletes associated conversation summaries in a transaction.
   * @param {string} conversationId - ID of the conversation to delete.
   * @returns {Promise<void>} - Promise that resolves when the deletion is complete.
   */
  static async deleteConversation(conversationId: string) {
    return prisma.$transaction([
      prisma.conversationSummary.deleteMany({
        where: {
          conversation_id: conversationId,
        },
      }),
      prisma.userConversation.delete({
        where: {
          id: conversationId,
        },
      }),
    ]);
  }

  /**
   * Updates conversation.
   *
   * @param {object} data - Data of the conversation to be updated.
   * @returns {Promise<object>} - Updated conversation object.
   */
  static async updateConversation(conversationId: string, data: any) {
    return prisma.userConversation.update({
      where: {
        id: conversationId,
      },
      data: {
        ...data,
      },
    });
  }

  /**
   * Updates conversation.
   *
   * @param {object} data - Data of the conversation to be updated.
   * @returns {Promise<object>} - Updated conversation object.
   */
  static async updateConversationStatus(conversationId: string, status: any) {
    return prisma.userConversation.update({
      where: {
        id: conversationId,
      },
      data: {
        conversation_status: status,
      },
    });
  }

  static async deleteConversationDraft(conversationId: string) {
    return prisma.userConversation.deleteMany({
      where: {
        id: conversationId,
      },
    });
  }
}
