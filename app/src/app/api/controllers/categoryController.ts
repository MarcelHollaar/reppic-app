import { NextRequest, NextResponse } from "next/server";
import { CategoryService } from "../services/categoryService";
import { prisma } from "../utils/prisma";
import { initializeI18n } from "../helpers/userHelper";

export class CategoryController {
  static async getAllCategories(req: NextRequest) {
    try {
      const user = (req as any).user;
      if (!user) {
        return NextResponse.json(
          { message: "Unauthorized User." },
          { status: 401 }
        );
      }
      const categories = await CategoryService.getAllCategories(req);
      return NextResponse.json(
        { message: "Categories fetched", data: categories },
        { status: 200 }
      );
    } catch (error) {
      console.log("Error while getting all categories ", error);
      return NextResponse.json({ message: error }, { status: 500 });
    }
  }

  static async createCategory(req: NextRequest, data: any) {
    try {
      const user = (req as any).user;
      if (!user) {
        return NextResponse.json(
          { message: "Unauthorized User." },
          { status: 401 }
        );
      }
      const result = await CategoryService.createCategory(data);
      if (!result) {
        return NextResponse.json(
          { message: "Couldn't able to create category." },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { message: "Category creation successful" },
        { status: 200 }
      );
    } catch (error) {
      console.log("Error while creating category ", error);
      return NextResponse.json({ message: error }, { status: 500 });
    }
  }

  static async updateCategory(req: NextRequest, data: any, categoryId: string) {
    try {
      const user = (req as any).user;
      if (!user) {
        return NextResponse.json(
          { message: "Unauthorized User." },
          { status: 401 }
        );
      }
      const result = await CategoryService.updateCategory(categoryId, data);
      if (!result) {
        return NextResponse.json(
          { message: "Couldn't able to update category." },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { message: "Category updation successful" },
        { status: 200 }
      );
    } catch (error) {
      console.log("Error while updating category ", error);
      return NextResponse.json({ message: error }, { status: 500 });
    }
  }

  static async deleteCategory(
    req: NextRequest,
    categoryId: any,
    langCode?: string
  ) {
    const i18n = await initializeI18n();
    if (langCode) {
      await i18n.changeLanguage(langCode);
    }
    const t = i18n.t;
    try {
      const user = (req as any).user;
      if (!user) {
        return NextResponse.json(
          { message: "Unauthorized User." },
          { status: 401 }
        );
      }

      const category = await prisma.category.findUnique({
        where: { id: categoryId },
        include: {
          videos: {
            where: {
              deleted_at: null,
            },
          },
        },
      });

      if (!category) {
        return { success: false, message: "Category not found." };
      }

      if (category.videos.length > 0) {
        return NextResponse.json(
          { message: t("errorMessages.categoryAssigned") },
          { status: 400 }
        );
      }

      const result = await CategoryService.deleteCategory(categoryId);
      if (!result) {
        return NextResponse.json(
          { message: t("errorMessages.couldNotDeleteCategory") },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { message: "Category deletion successful" },
        { status: 200 }
      );
    } catch (error) {
      console.log("Error while deleting the category ", error);
      return NextResponse.json({ message: error }, { status: 500 });
    }
  }

  static async getCategoryById(
    req: NextRequest,
    categoryId: string,
    langCode?: string
  ) {
    try {
      const user = (req as any).user;
      if (!user) {
        return NextResponse.json(
          { message: "Unauthorized User." },
          { status: 401 }
        );
      }
      const category = await CategoryService.getCategoryById(
        categoryId,
        langCode
      );
      return NextResponse.json(
        { message: "Category fetched", data: category },
        { status: 200 }
      );
    } catch (error) {
      console.log("Error while getting category by id ", error);
      return NextResponse.json({ message: error }, { status: 500 });
    }
  }
}
