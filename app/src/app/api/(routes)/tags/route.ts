import { NextRequest } from "next/server";
import { authMiddleware } from "../../middleware/authMiddleware";
import { types } from "../../utils/type-constants";
import { USER_ROLE } from "@/configs/constants";
import { TagController } from "../../controllers/tagController";

export async function GET(req: NextRequest) {
    const authCheck = await authMiddleware(req, USER_ROLE.SUPER_ADMIN);
    if (authCheck) return authCheck;
    const searchParams = req.nextUrl.searchParams;
    const type = searchParams.get("type");
    const id = searchParams.get("id");
     const langCode = searchParams.get("lang_code") || '';
    switch (type) {
        case types.GET_TAGS:
            return await TagController.getAllTags(req);
        case types.GET_TAG:
            if (!id) return new Response("Tag ID is required", { status: 400 });
            return await TagController.getTagById(req, id, langCode);
        default:
            return new Response("Invalid request type", { status: 400 });
    }
}

export async function POST(req: NextRequest) {
    const authCheck = await authMiddleware(req, USER_ROLE.SUPER_ADMIN);
    if (authCheck) return authCheck;

    const tagData = await req.json();
    return await TagController.createTag(req, tagData);
}


