import { NextRequest } from "next/server";
import { UserController } from "../../controllers/userController";
import { authMiddleware } from "../../middleware/authMiddleware";
import { USER_ROLE } from "@/configs/constants";

export async function GET(req: NextRequest) {
    const authCheck = await authMiddleware(req);
    if (authCheck) return authCheck;

    return UserController.getProfile(req);
}

export async function PUT(req: NextRequest) {
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

    return UserController.updateProfile(req, langCode);
}

export async function POST(req: NextRequest) {
    const authCheck = await authMiddleware(req,USER_ROLE.SUPER_ADMIN, true);
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

    return UserController.addUser(req, langCode);
}

export async function DELETE(req: NextRequest) {
    const authCheck = await authMiddleware(req, USER_ROLE.MANAGER);
    if (authCheck) return authCheck;

    return UserController.deleteUser(req);
}
