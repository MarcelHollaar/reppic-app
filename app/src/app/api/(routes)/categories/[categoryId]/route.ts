import { NextRequest } from "next/server";
import { authMiddleware } from "@/app/api/middleware/authMiddleware";
import { USER_ROLE } from "@/configs/constants";
import { CategoryController } from "@/app/api/controllers/categoryController";
import { types } from "../../../utils/type-constants";

export async function DELETE(req: NextRequest, context: { params: Promise<{ categoryId: string }> }) {
    const authCheck = await authMiddleware(req, USER_ROLE.SUPER_ADMIN);
    if (authCheck) return authCheck;
    const { categoryId } = await context.params;
    // Extract NEXT_LOCALE cookie
    let langCode: string | undefined = undefined;
    const cookieHeader = req.headers.get("cookie");
    if (cookieHeader) {
        const match = cookieHeader.match(/NEXT_LOCALE=([^;]+)/);
        if (match) {
            langCode = decodeURIComponent(match[1]);
        }
    }
    return await CategoryController.deleteCategory(req, categoryId, langCode);
    
}

export async function PUT(req: NextRequest, context: { params: Promise<{ categoryId: string }> }) {
    const authCheck = await authMiddleware(req, USER_ROLE.SUPER_ADMIN);
    if (authCheck) return authCheck;

    const categoryData = await req.json();
    const { categoryId } = await context.params;
    return await CategoryController.updateCategory(req, categoryData, categoryId)
}