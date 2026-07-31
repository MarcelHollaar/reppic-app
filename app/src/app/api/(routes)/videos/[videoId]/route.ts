import { NextRequest } from "next/server";
import { authMiddleware } from "@/app/api/middleware/authMiddleware";
import { USER_ROLE } from "@/configs/constants";
import { VideoController } from "@/app/api/controllers/videoController";
import { types } from "../../../utils/type-constants";

export async function DELETE(req: NextRequest, context: { params: Promise<{ videoId: string }> }) {
    const authCheck = await authMiddleware(req, USER_ROLE.SUPER_ADMIN);
    if (authCheck) return authCheck;
    const { videoId } = await context.params;
    return await VideoController.deleteVideo(req, videoId);
    
}

export async function PUT(req: NextRequest, context: { params: Promise<{ videoId: string }> }) {
    const authCheck = await authMiddleware(req, USER_ROLE.SUPER_ADMIN);
    if (authCheck) return authCheck;

    const formData = await req.formData();
    const type = formData.get("type");
    const videoDataRaw = formData.get("videoData");
    const thumbnail = formData.get("thumbnail") as File | null;

    let videoData: any = {};
    try {
        videoData = videoDataRaw ? JSON.parse(videoDataRaw.toString()) : {};
    } catch (error) {
        return new Response("Invalid videoData format", { status: 400 });
    }

    const { videoId } = await context.params;
    switch (type) {
        case types.UPDATE_VIDEO:
            return await VideoController.updateVideo(req, videoData, videoId, thumbnail)
        default:
            return new Response("Invalid request type", { status: 400 });
    }
}