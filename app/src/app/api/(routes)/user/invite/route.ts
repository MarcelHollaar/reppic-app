import { UserController } from "@/app/api/controllers/userController";
import { authMiddleware } from "@/app/api/middleware/authMiddleware";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
    const authCheck = await authMiddleware(req);
    if (authCheck) return authCheck;

    return UserController.inviteUsers(req);
}
