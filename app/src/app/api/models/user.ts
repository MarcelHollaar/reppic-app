import { Prisma } from "@prisma/client";
import { prisma } from "../utils/prisma";
import { NextRequest } from "next/server";
import { getFullUrl } from "../utils/urlHelper";
import { USER_ROLE } from "@/configs/constants";

export class UserModel {
  static async findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
    });
  }

  static async findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
    });
  }

  static async getTeamMembers(userId: string, req: NextRequest) {
    const managerUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { company_id: true, manager_id: true },
    });

    // Team root: a primary manager has no manager_id and is its own root; a
    // co-manager (invited by another manager) inherits that manager's team.
    // Everyone in a team shares the same root via manager_id, so a co-manager
    // sees exactly the same members as the primary manager.
    const rootManagerId = managerUser?.manager_id ?? userId;

    let whereClause: any = {
      manager_id: rootManagerId,
      // Don't list the requesting manager themselves.
      id: { not: userId },
    };

    if (!managerUser?.company_id) {
      console.error("Manager user not found or company ID is missing.");
    }

    const totalSubscriptions = await prisma.user.count({
      where: {
        company_id: managerUser.company_id,
      },
    });

    const searchParams = req.nextUrl.searchParams;

    const filters = {
      search: searchParams.get("search") || undefined,
    };

    const page = parseInt(searchParams.get("page") || "1");
    const per_page = parseInt(searchParams.get("per_page") || "10");
    const skip = (page - 1) * per_page;

    if (filters.search) {
      whereClause.OR = [
        { name: { contains: filters.search, mode: "insensitive" } },
        { email: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    const totalRecords = await prisma.user.count({ where: whereClause });

    // Get current month start and end dates
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // First get the basic user records
    const records = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        avatar: true,
        email: true,
        role: true,
        created_at: true,
        _count: {
          select: {
            user_conversations: true, // Count number of conversations per user
          },
        },
      },
      orderBy: {
        created_at: "desc",
      },
      skip: skip,
      take: per_page,
    });

    // Get the user IDs to fetch their conversation stats in one query
    const userIds = records.map((record) => record.id);

    if (userIds.length === 0) {
      return {
        records: [],
        pagination: {
          page,
          per_page,
          total_records: 0,
          total_pages: 0,
          total_subscriptions: totalSubscriptions,
        },
      };
    }

    // Get average conversation length for all users in one query
    const conversationStats = await prisma.userConversation.groupBy({
      by: ["user_id"],
      where: {
        user_id: { in: userIds },
      },
      _avg: {
        file_duration: true,
      },
    });

    // Get count of conversations THIS MONTH
    const monthlyConversationCounts = await prisma.userConversation.groupBy({
      by: ["user_id"],
      where: {
        user_id: { in: userIds },
        created_at: {
          gte: firstDayOfMonth,
          lte: lastDayOfMonth,
        },
      },
      _count: {
        _all: true,
      },
    });

    // Create a map for quick lookup of average duration by user ID
    const avgDurationMap = new Map(
      conversationStats.map((stat) => [stat.user_id, stat._avg.file_duration])
    );
    const monthlyCountMap = new Map(
      monthlyConversationCounts.map((stat) => [stat.user_id, stat._count._all])
    );

    const avgScoresRaw = await prisma.$queryRaw<
      { user_id: string; avg_score: number }[]
    >`SELECT 
          uc.user_id, 
          AVG(cs.score) AS avg_score
        FROM conversation_summaries cs
        JOIN user_conversations uc ON cs.conversation_id = uc.id
        WHERE uc.user_id IN (${Prisma.join(userIds)})
        GROUP BY uc.user_id`;

    const avgScoreMap = new Map(
      avgScoresRaw.map((row) => [row.user_id, Number(row.avg_score.toFixed(2))])
    );

    return {
      records: records.map((record) => {
        // Add the full avatar URL if avatar exists
        if (record.avatar) {
          record.avatar = getFullUrl(record.avatar); // Use the API route to construct full URL
        }

        return {
          ...record,
          avg_score: avgScoreMap.get(record.id) || 0,
          number_of_conversations: record._count.user_conversations,
          conversations_this_month: monthlyCountMap.get(record.id) || 0,
          avg_conversation_length: avgDurationMap.get(record.id) || 0, // Default to 0 if no conversations
        };
      }),
      pagination: {
        page,
        per_page,
        total_records: totalRecords,
        total_pages: Math.ceil(totalRecords / per_page),
        total_subscriptions: totalSubscriptions,
      },
    };
  }

  static async getAdminUsers(req: NextRequest) {
    let whereClause: any = {};

    const searchParams = req.nextUrl.searchParams;

    const filters = {
      search: searchParams.get("search") || undefined,
    };

    const page = parseInt(searchParams.get("page") || "1");
    const per_page = parseInt(searchParams.get("per_page") || "10");
    const skip = (page - 1) * per_page;

    // Build search where clause
    if (filters.search) {
      whereClause.OR = [
        { name: { contains: filters.search, mode: "insensitive" } },
        { email: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    // Only fetch admins
    whereClause.role = {
      name: USER_ROLE.SUPER_ADMIN,
    };

    const totalRecords = await prisma.user.count({ where: whereClause });

    const records = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        avatar: true,
        email: true,
        created_at: true,
      },
      orderBy: {
        created_at: "desc",
      },
      skip: skip,
      take: per_page,
    });

    // Optional: Attach full avatar URL if needed
    const finalRecords = records.map((record) => {
      if (record.avatar) {
        record.avatar = getFullUrl(record.avatar); // Assuming you have this helper
      }
      return record;
    });

    return {
      records: finalRecords,
      pagination: {
        page,
        per_page,
        total_records: totalRecords,
        total_pages: Math.ceil(totalRecords / per_page),
      },
    };
  }

  /**
   * Fetches all users for a given company, with pagination.
   * @param companyId The ID of the company to fetch users for.
   * @param req The NextRequest object, for reading search parameters.
   * @returns An object containing the results:
   */
  static async getCompanyUsers(companyId: string, req: NextRequest) {
    const whereClause: any = {
      company_id: companyId,
    };

    const searchParams = req.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const per_page = parseInt(searchParams.get("per_page") || "10");
    const skip = (page - 1) * per_page;

    // Get total records count
    const totalRecords = await prisma.user.count({ where: whereClause });

    // Get users with role names in a single query using join
    const records = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        avatar: true,
        email: true,
        created_at: true,
        role: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        created_at: "desc",
      },
      skip: skip,
      take: per_page,
    });

    // Get role counts with names in a single query
    const roleCounts = await prisma.role.findMany({
      where: {
        users: {
          some: {
            company_id: companyId,
          },
        },
      },
      select: {
        name: true,
        _count: {
          select: {
            users: {
              where: {
                company_id: companyId,
              },
            },
          },
        },
      },
    });

    // Convert role counts to the desired format
    const roleCountsMap = roleCounts.reduce((acc, role) => {
      acc[role.name] = role._count.users;
      return acc;
    }, {} as Record<string, number>);

    return {
      records: records.map((record) => ({
        ...record,
        role: record.role.name, // Keep just the role name if needed
        avatar: record.avatar ? getFullUrl(record.avatar) : null,
      })),
      role_counts: roleCountsMap,
      pagination: {
        page,
        per_page,
        total_records: totalRecords,
        total_pages: Math.ceil(totalRecords / per_page),
      },
    };
  }

  static async updateUserLangPreference(userId: string, langCode: string) {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { lang_code: langCode },
      });
      return { success: true };
    } catch (error) {
      console.error("Error updating language preference:", error);
      return { success: false, error: error?.message };
    }
  }

  static async getUserLangPreference(userId: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { lang_code: true },
      });

      return user?.lang_code || "en"; // Default to "en" if not set
    } catch (error) {
      console.error("Error retrieving language preference:", error);
      throw new Error(
        error?.message || "Error fetching user language preferences."
      );
    }
  }
}
