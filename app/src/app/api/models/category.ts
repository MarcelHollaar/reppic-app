import { prisma } from "../utils/prisma";
import { generateSlug } from "../utils/slugify";

export class CategoryModel {
  static async getCategories(req: any) {
    const searchParams = req.nextUrl.searchParams;
    const status = searchParams.get("status");
    const filters = {
      search: searchParams.get("search") || undefined,
    };

    const lang_code = searchParams.get("lang_code") || undefined;
    const is_dropdown = searchParams.get("is_dropdown") === "true";
    const page = parseInt(searchParams.get("page") || "1");
    const per_page = parseInt(searchParams.get("per_page") || "10");
    const skip = (page - 1) * per_page;

    let whereClause: any = { deleted_at: null };

    if (status) {
      whereClause.status = status;
    }

    if (filters.search) {
      whereClause.OR = [
        { name: { contains: filters.search, mode: "insensitive" } },
        { slug: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    const totalRecords = await prisma.category.count({ where: whereClause });

    let rawRecords;
    if (is_dropdown) {
      rawRecords = await prisma.category.findMany({
        where: whereClause,
        orderBy: { created_at: "desc" },
      });
    } else {
      rawRecords = await prisma.category.findMany({
        where: whereClause,
        orderBy: { created_at: "desc" },
        skip: skip,
        take: per_page,
      });
    }

    let translationsMap: Record<string, string> = {};
    if (lang_code) {
      const translations = await prisma.titleTranslation.findMany({
        where: {
          type: "category",
          lang_code,
          deleted_at: null,
        },
      });
      translationsMap = translations.reduce((acc, t) => {
        acc[t.type_id] = t.value;
        return acc;
      }, {} as Record<string, string>);
    }

    const records = rawRecords.map((category) => ({
      ...category,
      name:
        lang_code && translationsMap[category.id]
          ? translationsMap[category.id]
          : category.name,
    }));

    return {
      records: records,
      pagination: {
        page,
        per_page,
        total_records: totalRecords,
        total_pages: Math.ceil(totalRecords / per_page),
      },
    };
  }

  static async createCategory(data: any) {
    const slug = generateSlug(data.name);

    return prisma.category.create({
      data: {
        name: data.name,
        slug: slug,
        status: data.status,
      },
    });
  }

  static async getCategoryById(categoryId: string, langCode?: string) {
    const category = await prisma.category.findFirst({
      where: { id: categoryId, deleted_at: null },
      include: { videos: true },
    });

    if (!category) return null;

    // Fetch all title translations for this category
    const titles = await prisma.titleTranslation.findMany({
      where: {
        type: "category",
        type_id: category.id,
        deleted_at: null,
      },
      select: {
        lang_code: true,
        value: true,
      },
    });

    if (langCode) {
      const translation = titles.find((t) => t.lang_code === langCode);
      if (translation) {
        category.name = translation.value;
      }
    }

    // Attach all titles to the response
    category.titles = titles;

    return category;
  }

  static async updateCategory(categoryId: string, data: any) {
    const slug = generateSlug(data.name);

    return prisma.category.update({
      where: { id: categoryId },
      data: {
        name: data.name,
        slug: slug,
        status: data.status,
      },
    });
  }

  static async deleteCategory(categoryId: string) {
    return prisma.category.update({
      where: { id: categoryId },
      data: { deleted_at: new Date() },
    });
  }
}
