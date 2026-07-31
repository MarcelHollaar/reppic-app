import { NextRequest, NextResponse } from "next/server";
import { TeamMemberService } from "../services/teamMemberService";

export class TeamMemberController {
    static async getTeamMembers(req: NextRequest) {
        try {
            const user = (req as any).user;
            if (!user) {
                return NextResponse.json({ message: "Unauthorized User." }, { status: 401 });
            }

            const teamMembers = await TeamMemberService.getTeamMembers(user.id, req);
            return NextResponse.json({ message: "Team members fetched", data: teamMembers }, { status: 200 });
        } catch (error: any) {
            return NextResponse.json({ message: error.message }, { status: 500 });
        }
    }
    static async getAdminUsers(req: NextRequest) {
        try {
            const adminUsers = await TeamMemberService.getAdminUsers(req);
            return NextResponse.json({ message: "Admin users fetched", data: adminUsers }, { status: 200 });
        } catch (error : any) {
            return NextResponse.json({ message: error.message }, { status: 500 });
        }
    }

}
