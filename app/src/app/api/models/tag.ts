import { prisma } from "../utils/prisma";
import { generateSlug } from "../utils/slugify";

export class TagModel {
  static async getTags(req: any) {
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

    const totalRecords = await prisma.tag.count({ where: whereClause });

    let rawRecords;
    if (is_dropdown) {
      rawRecords = await prisma.tag.findMany({
        where: whereClause,
        orderBy: { created_at: "desc" },
      });
    } else {
      rawRecords = await prisma.tag.findMany({
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
          type: "tag",
          lang_code,
          deleted_at: null,
        },
      });
      translationsMap = translations.reduce((acc, t) => {
        acc[t.type_id] = t.value;
        return acc;
      }, {} as Record<string, string>);
    }

    const records = rawRecords.map((tag) => ({
      ...tag,
      name:
        lang_code && translationsMap[tag.id]
          ? translationsMap[tag.id]
          : tag.name,
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

  static async createTag(data: any) {
    const slug = generateSlug(data.name);

    return prisma.tag.create({
      data: {
        name: data.name,
        slug: slug,
        status: data.status,
      },
    });
  }

  static async getTagById(tagId: string, langCode?: string) {
    const tag = await prisma.tag.findFirst({
      where: { id: tagId, deleted_at: null },
      include: { videos: { include: { video: true } } },
    });

    if (!tag) return null;

    // Fetch all title translations for this tag
    const titles = await prisma.titleTranslation.findMany({
      where: {
        type: "tag",
        type_id: tag.id,
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
        tag.name = translation.value;
      }
    }

    // Attach all titles to the response
    tag.titles = titles;

    return tag;
  }

  static async updateTag(tagId: string, data: any) {
    const slug = generateSlug(data.name);
    return prisma.tag.update({
      where: { id: tagId },
      data: {
        name: data.name,
        slug: slug,
        status: data.status,
      },
    });
  }

  static async deleteTag(tagId: string) {
    return prisma.tag.update({
      where: { id: tagId },
      data: { deleted_at: new Date() },
    });
  }
}
