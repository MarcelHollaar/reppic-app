import { NextRequest, NextResponse } from "next/server";
import { NotificationService } from "../services/notificationService";

export class NotificationController {
    static async getNotifications(req: NextRequest, teamNotifications? : boolean) {
        try {
            const user = (req as any).user;
            if (!user) {
                return NextResponse.json({ message: "Unauthorized User." }, { status: 401 });
            }

            const { searchParams } = new URL(req.url);
            const userId = searchParams.get("user_id");

            let targetUserId: string | null = user.id; // Default to logged-in user

            if (teamNotifications) {
                if (userId) {
                    // If user_id is provided, fetch notification for that user
                    targetUserId = userId;
                } else {
                    // If no user_id, set null to indicate fetching all team notification
                    targetUserId = null;
                }
            }

            const notification = await NotificationService.getNotifications(req, teamNotifications, targetUserId);
            return NextResponse.json({ message: "Notifications fetched", data: notification }, { status: 200 });
        } catch (error: any) {
            return NextResponse.json({ message: error.message }, { status: 500 });
        }
    }
}
