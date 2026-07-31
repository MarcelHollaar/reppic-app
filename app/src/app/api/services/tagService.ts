import { TagModel } from "../models/tag";
import { NextRequest } from "next/server";
import { TitleTranslationModel } from "../models/titleTranslation";

export const TagService = {
    async getAllTags(req: NextRequest) {
        try {
            const tagsData = await TagModel.getTags(req);
            return tagsData;
        } catch (error) {
            console.log("Error while fetching all tags", error);
            throw error;
        }
    },

    async createTag(data: any) {
        try {
            const { titles } = data;
            const tagData = await TagModel.createTag(data);
            if (tagData && Array.isArray(titles)) {
                for (const t of titles) {
                    await TitleTranslationModel.AddOrUpdateTranslationByTypeAndTypeId({
                        type: "tag",
                        type_id: tagData.id,
                        lang_code: t.lang_code,
                        value: t.value,
                    });
                }
            }
            return tagData;
        } catch (error) {
            console.log("Error while creating tag", error);
            throw error;
        }
    },

    async updateTag(tagId: string, data: any) {
        try {
            const { titles, ...restData } = data;
            const tagData = await TagModel.updateTag(tagId, restData);
            if (tagData && Array.isArray(titles)) {
                for (const t of titles) {
                    await TitleTranslationModel.AddOrUpdateTranslationByTypeAndTypeId({
                        type: "tag",
                        type_id: tagData.id,
                        lang_code: t.lang_code,
                        value: t.value,
                    });
                }
            }
            return tagData;
        } catch (error) {
            console.log("Error while updating tag", error);
            throw error;
        }
    },

    async deleteTag(tagId: string) {
        try {
            const tagData = await TagModel.deleteTag(tagId);
            return tagData;
        } catch (error) {
            console.log("Error while deleting tag", error);
            throw error;
        }
    },

    async getTagById(tagId: string, langCode?: string) {
        try {
            const tagData = await TagModel.getTagById(tagId, langCode);
            return tagData;
        } catch (error) {
            console.log("Error while fetching tag by ID", error);
            throw error;
        }
    }
};
