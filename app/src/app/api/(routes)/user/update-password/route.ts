import { NextRequest } from "next/server";
import { authMiddleware } from "@/app/api/middleware/authMiddleware";
import { UserController } from "@/app/api/controllers/userController";

export async function POST(req: NextRequest) {
    const authCheck = await authMiddleware(req);
    if (authCheck) return authCheck;
    // Extract NEXT_LOCALE cookie
    let langCode: string | undefined = undefined;
    const cookieHeader = req.headers.get("cookie");
    if (cookieHeader) {
        const match = cookieHeader.match(/NEXT_LOCALE=([^;]+)/);
        if (match) {
            langCode = decodeURIComponent(match[1]);
        }
    }
    return UserController.updatePassword(req, langCode);
}