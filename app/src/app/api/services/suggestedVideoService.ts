import { NextRequest } from "next/server";
import { SuggestedVideoModel } from "../models/suggestedVideo";

export const SuggestedVideoService = {
  async getAllSuggestedVideos(req: NextRequest, userId: string) {
    try {
      const suggestedVideosData = await SuggestedVideoModel.getSuggestedVideos(
        req,
        userId
      );
      return suggestedVideosData;
    } catch (error) {
      console.error("Error while fetching all suggested videos", error);
      throw error;
    }
  },

  async getSuggestedVideoById(id: string) {
    try {
      const suggestedVideo = await SuggestedVideoModel.getSuggestedVideoById(
        id
      );
      return suggestedVideo;
    } catch (error) {
      console.error("Error while fetching suggested video by ID", error);
      throw error;
    }
  },
};
