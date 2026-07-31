import { NextRequest } from "next/server";
import { CategoryModel } from "../models/category";
import { TitleTranslationModel } from "../models/titleTranslation";


export const CategoryService = {
    async getAllCategories(req: NextRequest) {
        try {
            const categoriesData = await CategoryModel.getCategories(req);
            return categoriesData;
        } catch (error) {
            console.log('Error while fetching all categories ', error);
            throw error;
        }
    },

    async createCategory(data: any) {
        try {
            const { titles } = data;
            const categoryData = await CategoryModel.createCategory(data);
            if (categoryData && Array.isArray(titles)) {
                for (const t of titles) {
                    await TitleTranslationModel.AddOrUpdateTranslationByTypeAndTypeId({
                        type: "category",
                        type_id: categoryData.id,
                        lang_code: t.lang_code,
                        value: t.value,
                    });
                }
            }
            return categoryData;
        } catch (error) {
            console.log('Error while creating category ', error);
            throw error;
        }
    },

    async updateCategory(categoryId: string, data:any) {
        try {
            const { titles, ...restData } = data;
            const categoryData = await CategoryModel.updateCategory(categoryId, restData)
            if (categoryData && Array.isArray(titles)) {
                for (const t of titles) {
                    await TitleTranslationModel.AddOrUpdateTranslationByTypeAndTypeId({
                        type: "category",
                        type_id: categoryData.id,
                        lang_code: t.lang_code,
                        value: t.value,
                    });
                }
            }
            return categoryData;
        } catch (error) {
            console.log('Error while creating category ', error);
            throw error;
        }
    },

    async deleteCategory(categoryId: string) {
        try {
            const categoryData = await CategoryModel.deleteCategory(categoryId)
            return categoryData;
        } catch (error) {
            console.log('Error while deleting category ', error);
            throw error;
        }
    },
    
    async getCategoryById(categoryId: string, langCode?: string) {
        try {
            const categoryData = await CategoryModel.getCategoryById(categoryId, langCode)
            return categoryData;
        } catch (error) {
            console.log('Error while fetching category by ID ', error);
            throw error;
        }
    }
}