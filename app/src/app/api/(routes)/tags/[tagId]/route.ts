import { NextRequest } from "next/server";
import { authMiddleware } from "@/app/api/middleware/authMiddleware";
import { USER_ROLE } from "@/configs/constants";
import { TagController } from "@/app/api/controllers/tagController";

export async function DELETE(req: NextRequest, context: { params: Promise<{ tagId: string }> }) {
    const authCheck = await authMiddleware(req, USER_ROLE.SUPER_ADMIN);
    if (authCheck) return authCheck;
    const { tagId } = await context.params;
    // Extract NEXT_LOCALE cookie
    let langCode: string | undefined = undefined;
    const cookieHeader = req.headers.get("cookie");
    if (cookieHeader) {
        const match = cookieHeader.match(/NEXT_LOCALE=([^;]+)/);
        if (match) {
            langCode = decodeURIComponent(match[1]);
        }
    }
    return await TagController.deleteTag(req, tagId, langCode);
}

export async function PUT(req: NextRequest, context: { params: Promise<{ tagId: string }> }) {
    const authCheck = await authMiddleware(req, USER_ROLE.SUPER_ADMIN);
    if (authCheck) return authCheck;

    const tagData = await req.json();
    const { tagId } = await context.params;

    return await TagController.updateTag(req, tagData, tagId);
}
