import { NextRequest, NextResponse } from "next/server";
import { SuggestedVideoService } from "../services/suggestedVideoService";

export class SuggestedVideoController {
    static async getAllSuggestedVideos(req: NextRequest) {
        try {
            const user = (req as any).user;
            if (!user) {
                return NextResponse.json({ message: "Unauthorized User." }, { status: 401 });
            }
            const suggestedVideos = await SuggestedVideoService.getAllSuggestedVideos(req, user.id);
            return NextResponse.json({ message: "Suggested Videos fetched", data: suggestedVideos }, { status: 200 });
        } catch (error) {
            console.log("Error while getting all suggested videos", error);
            return NextResponse.json({ message: error }, { status: 500 });
        }
    }

    static async getSuggestedVideoById(req: NextRequest, id: string) {
        try {
            const user = (req as any).user;
            if (!user) {
                return NextResponse.json({ message: "Unauthorized User." }, { status: 401 });
            }
            const suggestedVideo = await SuggestedVideoService.getSuggestedVideoById(id);
            return NextResponse.json({ message: "Suggested Video fetched", data: suggestedVideo }, { status: 200 });
        } catch (error) {
            console.log("Error while getting suggested video by id", error);
            return NextResponse.json({ message: error }, { status: 500 });
        }
    }
}
