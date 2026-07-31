import { prisma } from "../utils/prisma";

export class PromptModel {
  static async list(req: any) {
    const searchParams = req.nextUrl.searchParams;
    const lang_code = searchParams.get("lang_code") || undefined;
    const search = searchParams.get("search") || undefined;
    const page = parseInt(searchParams.get("page") || "1");
    const per_page = parseInt(searchParams.get("per_page") || "10");
    const skip = (page - 1) * per_page;

    const where: any = {};
    if (lang_code) where.lang_code = lang_code;
    if (search) {
      where.prompt = { contains: search, mode: "insensitive" };
    }

    const totalRecords = await prisma.prompt.count({ where });
    const records = await prisma.prompt.findMany({
      where,
      orderBy: { updated_at: "desc" },
      skip,
      take: per_page,
    });

    return {
      records,
      pagination: {
        page,
        per_page,
        total_records: totalRecords,
        total_pages: Math.ceil(totalRecords / per_page),
      },
    };
  }

  static async getById(id: string) {
    return prisma.prompt.findUnique({ where: { id } });
  }

  static async upsertManyByLang(payload: {
    promptsByLang: Record<string, string>;
  }) {
    const { promptsByLang } = payload;
    const results: any[] = [];
    for (const [lang, data] of Object.entries(promptsByLang)) {
      const where = { lang_code: lang } as any;
      const existing = await prisma.prompt.findFirst({ where });
      if (existing) {
        const updated = await prisma.prompt.update({
          where: { id: existing.id },
          data: { prompt: String(data), lang_code: lang },
        });
        results.push(updated);
      } else {
        const created = await prisma.prompt.create({
          data: { prompt: String(data), lang_code: lang },
        });
        results.push(created);
      }
    }
    return results;
  }

  static async update(id: string, data: any) {
    return prisma.prompt.update({
      where: { id },
      data: { prompt: String(data?.prompt || "") },
    });
  }

  static async delete(id: string) {
    return prisma.prompt.delete({ where: { id } });
  }

  static async findForKnowledge(lang: string) {
    return prisma.prompt.findMany({
      where: { lang_code: lang },
      orderBy: { updated_at: "desc" },
    });
  }

  static async getLatestForLang(lang: string) {
    return prisma.prompt.findFirst({
      where: { lang_code: lang },
      orderBy: { updated_at: "desc" },
    });
  }
}
