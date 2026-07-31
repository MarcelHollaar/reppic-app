import { NextRequest, NextResponse } from "next/server";
import { StatsService } from "../services/statsService";
import { isSuperAdminUser } from "../helpers/userHelper";

export class StatsController {
    static async getDashboardStats(req: NextRequest) {
        try {
            const loggedInUser = (req as any).user;
            if (!loggedInUser) {
                return NextResponse.json({ message: "Unauthorized User." }, { status: 401 });
            }

            // Extract query parameters
            const { start_date, end_date, user_id, type } = Object.fromEntries(req.nextUrl.searchParams);

            const isAdmin = isSuperAdminUser(loggedInUser)

            if (!isAdmin && (!start_date || !end_date)) {
                return NextResponse.json({ message: "Start date and End date are required." }, { status: 400 });
            }

            let stats = null
            if ( isAdmin ) {
                stats = await StatsService.getAdminDashboardStats();
            } else {
                stats = await StatsService.getDashboardStats(start_date, end_date, loggedInUser,type, user_id);
            }

            return NextResponse.json({ message: "Stats fetched successfully.", data: stats }, { status: 200 });
        } catch (error: any) {
            return NextResponse.json({ message: error.message }, { status: 500 });
        }
    }

    static async getProgressStats(req: NextRequest) {
        try {
            const loggedInUser = (req as any).user;
            if (!loggedInUser) {
                return NextResponse.json({ message: "Unauthorized User." }, { status: 401 });
            }

            const { range, user_id } = Object.fromEntries(req.nextUrl.searchParams);

            const stats = await StatsService.getProgressStats(range, loggedInUser, user_id);

            return NextResponse.json({ message: "Stats fetched successfully.", data: stats }, { status: 200 });
        } catch (error: any) {
            return NextResponse.json({ message: error.message }, { status: 500 });
        }
    }
}
