import { NextRequest } from "next/server";
import { authMiddleware } from "../../middleware/authMiddleware";
import { types } from "../../utils/type-constants";
import { USER_ROLE } from "@/configs/constants";
import { SuggestedVideoController } from "../../controllers/suggestedVideoController";

export async function GET(req: NextRequest) {
    const authCheck = await authMiddleware(req);
    if (authCheck) return authCheck;

    const searchParams = req.nextUrl.searchParams;
    const type = searchParams.get("type");
    const id = searchParams.get("id");
    switch (type) {
        case types.GET_SUGGESTED_VIDEOS:
            return await SuggestedVideoController.getAllSuggestedVideos(req);
        case types.GET_SUGGESTED_VIDEO:
            if (!id) return new Response("Suggested Video ID is required", { status: 400 });
            return await SuggestedVideoController.getSuggestedVideoById(req, id);
        default:
            return new Response("Invalid request type", { status: 400 });
    }
}

