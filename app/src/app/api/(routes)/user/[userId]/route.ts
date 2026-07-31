import { NextRequest } from "next/server";
import { UserController } from "../../../controllers/userController";
import { authMiddleware } from "../../../middleware/authMiddleware";
import { USER_ROLE } from "@/configs/constants";

export async function GET(req: NextRequest, context: { params: Promise<{ userId: string }> }) {
    const authCheck = await authMiddleware(req);
    if (authCheck) return authCheck;
    const { userId } = await context.params;
    return UserController.getProfileById(req, userId);
}
