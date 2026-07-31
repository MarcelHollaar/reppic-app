import { NextRequest } from "next/server";
import { authMiddleware } from "../../middleware/authMiddleware";
import { types } from "../../utils/type-constants";
import { USER_ROLE } from "@/configs/constants";
import { VideoController } from "../../controllers/videoController";

export async function GET(req: NextRequest) {
    const authCheck = await authMiddleware(req);
    if (authCheck) return authCheck;
    const searchParams = req.nextUrl.searchParams;
    const type = searchParams.get("type");
    const id = searchParams.get("id");
    const langCode = searchParams.get("lang_code");
    switch (type) {
        case types.GET_VIDEOS:
          return await VideoController.getAllVideos(req)
        case types.GET_VIDEO:
            if (!id) return new Response("Video ID is required", { status: 400 });
            return await VideoController.getVideoById(req, id, langCode);
        default:
            return new Response("Invalid request type", { status: 400 });
    }
}

export async function POST(req: NextRequest) {
    const authCheck = await authMiddleware(req, USER_ROLE.SUPER_ADMIN);
    if (authCheck) return authCheck;

    const formData = await req.formData();
    const type = formData.get("type");
    const videoDataRaw = formData.get("videoData");
    const thumbnail = formData.get("thumbnail") as File | null;

    // Parse videoData if it's sent as a JSON string
    let videoData: any = {};
    try {
        videoData = videoDataRaw ? JSON.parse(videoDataRaw.toString()) : {};
    } catch (error) {
        return new Response("Invalid videoData format", { status: 400 });
    }

    switch (type) {
        case types.CREATE_VIDEO:
            return await VideoController.createVideo(req, videoData, thumbnail);
        default:
            return new Response("Invalid request type", { status: 400 });
    }
}



