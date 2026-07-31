import { types } from "@/app/api/utils/type-constants";
import { UserController } from "@/app/api/controllers/userController";
import { NextRequest } from "next/server";
import { authMiddleware } from "@/app/api/middleware/authMiddleware";

export async function POST(req: NextRequest) {
    const authCheck = await authMiddleware(req);
    if (authCheck) return authCheck;
    const { type, data } = await req.json();
    switch (type) {
        case types.UPDATE_USER_PREFERENCES:
            return await UserController.updateUserPreferences(req, data);
        case types.UPDATE_USER_LANG_PREFERENCES:
            return await UserController.updateUserLanguagePreferences(req, data);
        default:
            return new Response("Invalid request type", { status: 400 });
    }
}


export async function GET(req: NextRequest) {
    const authCheck = await authMiddleware(req);
    if (authCheck) return authCheck;
    const searchParams = req.nextUrl.searchParams;
    const type = searchParams.get("type");
    switch (type) {
        case types.GET_USER_LANG_PREFERENCES:
            return await UserController.getUserLanguagePreferences(req);
        default:
            return new Response("Invalid request type", { status: 400 });
    }
}