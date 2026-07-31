import { NextRequest, NextResponse } from "next/server";
import { VideoService } from "../services/videoServices";

export class VideoController {
    static async getAllVideos(req: NextRequest) {
        try {
            const user = (req as any).user;
            if (!user) {
                return NextResponse.json({ message: "Unauthorized User." }, { status: 401 });
            }
            const videos = await VideoService.getAllVideos(req);
            return NextResponse.json({ message: "Videos fetched", data: videos }, { status: 200 });
        } catch (error) {
            console.log("Error while getting all videos", error);
            return NextResponse.json({ message: error }, { status: 500 });
        }
    }

    static async createVideo(req: NextRequest, data: any, thumbnail: File | null) {
        try {
            const user = (req as any).user;
            if (!user) {
                return NextResponse.json({ message: "Unauthorized User." }, { status: 401 });
            }

            let fileBuffer = null;
            let fileName = "";

            if (thumbnail) {
                fileBuffer = await thumbnail.arrayBuffer();
                fileName = thumbnail.name;
            }
            const result = await VideoService.createVideo(data, fileBuffer, fileName);
            if (!result) {
                return NextResponse.json({ message: "Couldn't create video." }, { status: 400 });
            }
            return NextResponse.json({ message: "Video creation successful" }, { status: 200 });
        } catch (error) {
            console.error("Error while creating video:", error?.message); // Improved logging
            return NextResponse.json({ message: error?.message || error }, { status: 500 });
        }
    }

    static async updateVideo(req: NextRequest, data: any, videoId: string, thumbnail: File | null) {
        try {
            const user = (req as any).user;
            if (!user) {
                return NextResponse.json({ message: "Unauthorized User." }, { status: 401 });
            }

            let fileBuffer = null;
            let fileName = "";

            if (thumbnail) {
                fileBuffer = await thumbnail.arrayBuffer();
                fileName = thumbnail.name;
            }
            const result = await VideoService.updateVideo(videoId, data, fileBuffer, fileName);
            if (!result) {
                return NextResponse.json({ message: "Couldn't update video." }, { status: 400 });
            }
            return NextResponse.json({ message: "Video update successful" }, { status: 200 });
        } catch (error) {
            console.log("Error while updating video", error);
            return NextResponse.json({ message: error }, { status: 500 });
        }
    }

    static async deleteVideo(req: NextRequest, videoId: string) {
        try {
            const user = (req as any).user;
            if (!user) {
                return NextResponse.json({ message: "Unauthorized User." }, { status: 401 });
            }
            const result = await VideoService.deleteVideo(videoId);
            if (!result) {
                return NextResponse.json({ message: "Couldn't delete video." }, { status: 400 });
            }
            return NextResponse.json({ message: "Video deletion successful" }, { status: 200 });
        } catch (error) {
            console.log("Error while deleting video", error);
            return NextResponse.json({ message: error }, { status: 500 });
        }
    }

    static async getVideoById(req: NextRequest, videoId: string, langCode?: string) {
        try {
            const user = (req as any).user;
            if (!user) {
                return NextResponse.json({ message: "Unauthorized User." }, { status: 401 });
            }
            const video = await VideoService.getVideoById(videoId, langCode);
            if (!video) {
                return NextResponse.json({ message: "Video not found." }, { status: 404 });
            }
            return NextResponse.json({ message: "Video fetched", data: video }, { status: 200 });
        } catch (error) {
            console.log("Error while fetching video by ID", error);
            return NextResponse.json({ message: error }, { status: 500 });
        }
    }
}
