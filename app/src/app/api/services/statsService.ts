import {
  CONVERSATION_STATUS,
  TEAM_STATS,
  USER_ROLE,
} from "@/configs/constants";
import { prisma } from "../utils/prisma";
import {
  format,
  eachMonthOfInterval,
  subDays,
  subMonths,
  eachDayOfInterval,
  eachHourOfInterval,
} from "date-fns";

export const StatsService = {
  async getDashboardStats(
    startDate: string,
    endDate: string,
    loggedInUser: any,
    type: string,
    userId: string | null
  ) {
    let userIds: string[] = [];

    // Fetch the logged-in user's role
    const loggedInUserWithRole = await prisma.user.findUnique({
      where: { id: loggedInUser.id },
      select: { role: true },
    });

    if (
      type === TEAM_STATS &&
      loggedInUserWithRole?.role?.name === USER_ROLE.MANAGER
    ) {
      // Fetch data for the manager's team members
      const teamMembers = await prisma.user.findMany({
        where: { manager_id: loggedInUser?.id },
        select: { id: true },
      });

      userIds = [loggedInUser?.id, ...teamMembers.map((user) => user.id)];
    } else {
      // Fetch stats for specific user OR the logged-in user
      if (userId) {
        userIds = [userId];
      } else {
        userIds = [loggedInUser?.id];
      }
    }

    if (userIds.length === 0) {
      return {
        average_conversations: { current: 0, previous: 0, change: 0 },
        average_conversation_length: { current: 0, previous: 0, change: 0 },
        avg_talk_ratio: { current: 0, previous: 0, change: 0 },
      };
    }

    // Calculate previous period's date range
    const start = new Date(startDate + "T00:00:00.000Z");
    const end = new Date(endDate + "T23:59:59.999Z");
    const periodLength = end.getTime() - start.getTime(); // Time difference in milliseconds

    const previousEndDate = new Date(start.getTime() - 1);
    const previousStartDate = new Date(
      previousEndDate.getTime() - periodLength
    );

    // Fetch conversation stats for current period
    const currentConversations = await prisma.userConversation.findMany({
      where: {
        user_id: { in: userIds },
        meeting_date: { gte: start, lte: end },
        conversation_status: {
          not: null,
          in: [CONVERSATION_STATUS.COMPLETED_TWIN_AI_PROCESS],
        },
      },
      include: { conversation_summaries: true, conversation_summaries_x: true },
    });

    // Fetch conversation stats for previous period
    const previousConversations = await prisma.userConversation.findMany({
      where: {
        user_id: { in: userIds },
        meeting_date: { gte: previousStartDate, lte: previousEndDate },
        conversation_status: {
          not: null,
          in: [CONVERSATION_STATUS.COMPLETED_TWIN_AI_PROCESS],
        },
      },
      include: { conversation_summaries: true, conversation_summaries_x: true },
    });

    const formatDuration = (seconds: number) => {
      const totalMinutes = Math.floor(seconds / 60);

      if (totalMinutes >= 60) {
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
          2,
          "0"
        )} hrs`;
      } else {
        const minutes = totalMinutes;
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}:${String(remainingSeconds).padStart(2, "0")} min`;
      }
    };

    // Helper function to calculate metrics
    function calculateMetrics(conversations) {
      if (conversations.length === 0)
        return { count: 0, length: 0, talkRatio: 0 };

      const totalConversations = conversations.length;
      const totalLengthInSeconds = conversations.reduce((sum, conv) => {
        return sum + (conv.file_duration ?? 0);
      }, 0);

      const averageLengthInSeconds = totalLengthInSeconds / totalConversations;

      const totalTalkRatio = conversations.reduce((sum, conv) => {
        const summary = conv.conversation_summaries_x?.[0];
        return sum + (summary?.salesperson_percentage ?? 0);
      }, 0);

      return {
        count: totalConversations,
        length: formatDuration(averageLengthInSeconds),
        talkRatio: (totalTalkRatio / totalConversations).toFixed(2),
      };
    }

    // Non-sales conversations must not count in these performance stats
    // (talk ratio especially — a one-speaker monologue is 100%).
    const isSalesConversation = (conv: any) =>
      conv.conversation_summaries_x?.[0]?.geen_salesgesprek !== true;

    const currentStats = calculateMetrics(
      currentConversations.filter(isSalesConversation),
    );
    const previousStats = calculateMetrics(
      previousConversations.filter(isSalesConversation),
    );

    // Helper function to calculate percentage change
    function calculateChange(current, previous) {
      const curr = parseFloat(current) || 0;
      const prev = parseFloat(previous) || 0;

      if (isNaN(curr) || isNaN(prev)) return 0;

      if (prev === 0) return curr > 0 ? 100 : 0;

      return Math.round(((curr - prev) / prev) * 100 * 100) / 100;
    }

    return {
      average_conversations: {
        current: currentStats.count,
        previous: previousStats.count,
        change: calculateChange(currentStats.count, previousStats.count),
      },
      average_conversation_length: {
        current: currentStats.length,
        previous: previousStats.length,
        change: calculateChange(currentStats.length, previousStats.length),
      },
      avg_talk_ratio: {
        current: currentStats.talkRatio,
        previous: previousStats.talkRatio,
        change: calculateChange(
          currentStats.talkRatio,
          previousStats.talkRatio
        ),
      },
    };
  },

  async getAdminDashboardStats() {
    const now = new Date();
    const end = new Date(now);
    const start = new Date(end);
    start.setMonth(start.getMonth() - 1);

    const periodLength = end.getTime() - start.getTime();

    const previousEndDate = new Date(start.getTime() - 1);
    const previousStartDate = new Date(
      previousEndDate.getTime() - periodLength
    );

    // Count current period
    const currentConversations = await prisma.userConversation.count({
      where: { meeting_date: { gte: start, lte: end } },
    });

    const currentUsers = await prisma.user.count({
      where: { created_at: { gte: start, lte: end } },
    });

    const currentCompanies = await prisma.company.count({
      where: { created_at: { gte: start, lte: end } },
    });

    // Count previous period
    const previousConversations = await prisma.userConversation.count({
      where: { meeting_date: { gte: previousStartDate, lte: previousEndDate } },
    });

    const previousUsers = await prisma.user.count({
      where: { created_at: { gte: previousStartDate, lte: previousEndDate } },
    });

    const previousCompanies = await prisma.company.count({
      where: { created_at: { gte: previousStartDate, lte: previousEndDate } },
    });

    // Helper to calculate change
    const calculateChange = (current: number, previous: number) => {
      const curr = parseFloat(current as any) || 0;
      const prev = parseFloat(previous as any) || 0;

      if (isNaN(curr) || isNaN(prev)) return 0;
      if (prev === 0) return curr > 0 ? 100 : 0;

      return Math.round(((curr - prev) / prev) * 100 * 100) / 100;
    };

    return {
      total_conversations: {
        current: currentConversations,
        previous: previousConversations,
        change: calculateChange(currentConversations, previousConversations),
      },
      total_users: {
        current: currentUsers,
        previous: previousUsers,
        change: calculateChange(currentUsers, previousUsers),
      },
      total_companies: {
        current: currentCompanies,
        previous: previousCompanies,
        change: calculateChange(currentCompanies, previousCompanies),
      },
    };
  },

  async getProgressStats(
    range: string,
    currentUser: any,
    userId: string | null
  ) {
    const now = new Date();

    const getStartDateAndFormatter = (range: string) => {
      switch (range) {
        case "12months":
          return {
            from: subMonths(now, 11),
            formatter: (date: Date) => format(date, "yyyy-MM"),
            generator: () =>
              eachMonthOfInterval({ start: subMonths(now, 11), end: now }).map(
                (d) => format(d, "yyyy-MM")
              ),
          };
        case "3months":
          return {
            from: subMonths(now, 2),
            formatter: (date: Date) => format(date, "yyyy-MM"),
            generator: () =>
              eachMonthOfInterval({ start: subMonths(now, 2), end: now }).map(
                (d) => format(d, "yyyy-MM")
              ),
          };
        case "30days":
          return {
            from: subDays(now, 29),
            formatter: (date: Date) => format(date, "yyyy-MM-dd"),
            generator: () =>
              eachDayOfInterval({ start: subDays(now, 29), end: now }).map(
                (d) => format(d, "yyyy-MM-dd")
              ),
          };
        case "7days":
          return {
            from: subDays(now, 6),
            formatter: (date: Date) => format(date, "yyyy-MM-dd"),
            generator: () =>
              eachDayOfInterval({ start: subDays(now, 6), end: now }).map((d) =>
                format(d, "yyyy-MM-dd")
              ),
          };
        case "24hours":
          return {
            from: subDays(now, 1),
            formatter: (date: Date) => format(date, "yyyy-MM-dd HH:00"),
            generator: () =>
              eachHourOfInterval({ start: subDays(now, 1), end: now }).map(
                (d) => format(d, "yyyy-MM-dd HH:00")
              ),
          };
        default:
          throw new Error("Invalid range");
      }
    };

    const { from, formatter, generator } = getStartDateAndFormatter(range);

    // Fetch user access
    currentUser = await prisma.user.findUnique({
      where: { id: currentUser.id },
      select: {
        id: true,
        role: { select: { name: true } },
        team: { select: { id: true } },
      },
    });

    if (!currentUser) throw new Error(`User not found.`);

    let targetUserIds: string[] = [];

    const isManager = currentUser.role.name === USER_ROLE.MANAGER;

    if (isManager) {
      if (userId) {
        // Viewing a specific user – must be in team or self
        const teamUserIds = currentUser.team.map((u) => u.id);
        if (userId === currentUser.id || teamUserIds.includes(userId)) {
          targetUserIds = [userId];
        } else {
          throw new Error("Unauthorized to view this user's stats.");
        }
      } else {
        // Manager viewing all team stats (default)
        targetUserIds = [currentUser.id, ...currentUser.team.map((u) => u.id)];
      }
    } else {
      // Normal user can only view their own stats
      targetUserIds = [currentUser.id];
    }

    // Fetch conversations
    const conversations = await prisma.userConversation.findMany({
      where: {
        user_id: { in: targetUserIds },
        meeting_date: { gte: from },
        conversation_summaries_x: { some: {} },
      },
      include: {
        conversation_summaries: { select: { score: true } },
        conversation_summaries_x: { select: { total_score: true } },
      },
    });

    // Prepare empty label map
    const allLabels = generator();
    const grouped: Record<string, number[]> = {};
    allLabels.forEach((label) => {
      grouped[label] = [];
    });

    // Fill real data
    for (const conversation of conversations) {
      let label: string;

      if (range === "24hours" && conversation.meeting_time_start) {
        // Combine date + time string
        const datetimeStr = `${format(
          conversation.meeting_date,
          "yyyy-MM-dd"
        )}T${conversation.meeting_time_start}`;
        const fullDate = new Date(datetimeStr);
        label = formatter(fullDate);
      } else {
        label = formatter(conversation.meeting_date);
      }

      const scores = conversation.conversation_summaries_x.map(
        (s) => s.total_score
      );
      if (!grouped[label]) {
        grouped[label] = [];
      }
      grouped[label].push(...scores);
    }

    // Compute averages
    const result = allLabels.map((label) => {
      const scores = grouped[label];
      const avg =
        scores.length > 0
          ? scores.reduce((sum, s) => sum + s, 0) / scores.length
          : 0;
      return {
        label,
        avg_score: Number(avg.toFixed(2)),
      };
    });

    return result;
  },
};
