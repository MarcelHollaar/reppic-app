import { TitleTranslationModel } from "../models/titleTranslation";
import { VideoModel } from "../models/video";
import { NextRequest } from "next/server";

export const VideoService = {
    async getAllVideos(req: NextRequest) {
        try {
            const videosData = await VideoModel.getVideos(req);
            return videosData;
        } catch (error) {
            console.log("Error while fetching all videos", error);
            throw error;
        }
    },

    async createVideo(data: any, fileBuffer: ArrayBuffer | null, fileName: string) {
        try {
            if (!data || typeof data !== "object" || !data.tags || !Array.isArray(data.tags)) {
                throw new TypeError("Invalid data: The 'data' argument must be a valid object with a 'tags' array.");
            }
            const { titles } = data;
            const videoData = await VideoModel.createVideo(data, fileBuffer, fileName);
            if (videoData && Array.isArray(titles)) {
                for (const t of titles) {
                    await TitleTranslationModel.AddOrUpdateTranslationByTypeAndTypeId({
                        type: "video",
                        type_id: videoData.id,
                        lang_code: t.lang_code,
                        value: t.value,
                        embedded_code: t.embedded_code || "",
                    });
                }
            }
            return videoData;
        } catch (error) {
            console.log("Error while creating video", error?.message); // Log error message
            throw error;
        }
    },

    async updateVideo(videoId: string, data: any, fileBuffer: ArrayBuffer | null, fileName: string) {
        try {
            const { titles, ...restData } = data;
            const videoData = await VideoModel.updateVideo(videoId, restData, fileBuffer, fileName);
            if (videoData && Array.isArray(titles)) {
                for (const t of titles) {
                    await TitleTranslationModel.AddOrUpdateTranslationByTypeAndTypeId({
                        type: "video",
                        type_id: videoData.id,
                        lang_code: t.lang_code,
                        value: t.value,
                        embedded_code: t.embedded_code || "",
                    });
                }
            }
            return videoData;
        } catch (error) {
            console.log("Error while updating video", error);
            throw error;
        }
    },

    async deleteVideo(videoId: string) {
        try {
            const videoData = await VideoModel.deleteVideo(videoId);
            return videoData;
        } catch (error) {
            console.log("Error while deleting video", error);
            throw error;
        }
    },

    async getVideoById(videoId: string, langCode?: string) {
        try {
            const videoData = await VideoModel.getVideoById(videoId, langCode);
            return videoData;
        } catch (error) {
            console.log("Error while fetching video by ID", error);
            throw error;
        }
    },
};
