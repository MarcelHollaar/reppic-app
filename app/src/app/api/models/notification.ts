import { prisma } from "../utils/prisma";
import { NextRequest } from "next/server";

export class NotificationModel {
  static async getUserNotifications(
    req: NextRequest,
    teamNotifications: boolean = false,
    userId: string | null
  ) {
    const searchParams = req.nextUrl.searchParams;

    const page = parseInt(searchParams.get("page") || "1");
    const per_page = parseInt(searchParams.get("per_page") || "10");
    const skip = (page - 1) * per_page;

    let userIds: string[] = [];

    if (teamNotifications) {
      if (userId) {
        // Fetch notifications for the specific user provided in the request
        userIds = [userId];
      } else {
        const user = (req as any).user;
        const teamMembers = await prisma.user.findMany({
          where: { manager_id: user?.id },
          select: { id: true },
        });

        userIds = teamMembers.map((member) => member.id);
        userIds.push(user.id);
      }
    } else {
      // Fetch notifications for the logged-in user
      userIds = [userId!];
    }

    let whereClause: any = {
      user_id: { in: userIds },
    };

    const totalRecords = await prisma.notification.count({
      where: whereClause,
    });

    const records = await prisma.notification.findMany({
      where: whereClause,
      include: {
        user: true,
      },
      orderBy: {
        created_at: "desc",
      },
      skip: skip,
      take: per_page,
    });
    return {
      records: records,
      pagination: {
        page,
        per_page,
        total_records: totalRecords,
        total_pages: Math.ceil(totalRecords / per_page),
      },
    };
  }
}
