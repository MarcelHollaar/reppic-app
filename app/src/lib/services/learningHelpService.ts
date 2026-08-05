/**
 * Help-center (LMS 1:1 P3) — port van productie storage.ts help-functies +
 * /api/help/* routes. Artikelen gefilterd op rol (all/learner/admin), taal en
 * optionele paginacontext; beheer (CRUD) voor learning_admin/superadmin.
 */
import { prisma } from "@/app/api/utils/prisma";

export type HelpRole = "all" | "learner" | "admin";

/** LMS-rol van de app-gebruiker → help-doelrol (zoals productie req.user.role). */
export function helpRoleFor(user: {
  learning_role?: string | null;
  role?: string | null;
}): HelpRole {
  const lr = (user.learning_role || "").toLowerCase();
  if (lr.includes("admin") || (user.role || "").includes("admin")) {
    return "admin";
  }
  return "learner";
}

const publishedFor = (role: HelpRole, language: string) => ({
  is_published: true,
  language,
  OR: [{ target_role: role }, { target_role: "all" }],
});

const helpOrder = [
  { sort_order: "asc" as const },
  { created_at: "asc" as const },
];

export const learningHelpService = {
  // ── lezen (alle ingelogde gebruikers) ──
  async getArticles(role: HelpRole, language = "en") {
    return prisma.helpArticle.findMany({
      where: publishedFor(role, language),
      orderBy: helpOrder,
    });
  },

  async searchArticles(query: string, role: HelpRole, language = "en") {
    return prisma.helpArticle.findMany({
      where: {
        is_published: true,
        language,
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { content: { contains: query, mode: "insensitive" } },
          { excerpt: { contains: query, mode: "insensitive" } },
        ],
        AND: { OR: [{ target_role: role }, { target_role: "all" }] },
      },
      orderBy: helpOrder,
    });
  },

  async getArticlesByPage(pageContext: string, role: HelpRole, language = "en") {
    return prisma.helpArticle.findMany({
      where: { page_context: pageContext, ...publishedFor(role, language) },
      orderBy: helpOrder,
    });
  },

  /** Enkel artikel + view-teller ophogen (zoals productie). */
  async getArticle(id: string) {
    const article = await prisma.helpArticle.findUnique({ where: { id } });
    if (!article) return null;
    await prisma.helpArticle
      .update({ where: { id }, data: { view_count: { increment: 1 } } })
      .catch(() => {});
    return article;
  },

  async getCategories() {
    return prisma.helpCategory.findMany({
      orderBy: [{ sort_order: "asc" }, { created_at: "asc" }],
    });
  },

  // ── beheer (admin) ──
  async getAllArticlesForAdmin() {
    return prisma.helpArticle.findMany({
      orderBy: helpOrder,
      include: { category: true },
    });
  },

  async createArticle(
    data: {
      title: string;
      content: string;
      excerpt?: string | null;
      category_id?: string | null;
      page_context?: string | null;
      target_role?: string;
      language?: string;
      is_published?: boolean;
      sort_order?: number;
    },
    createdBy: string,
  ) {
    return prisma.helpArticle.create({
      data: {
        title: data.title,
        content: data.content,
        excerpt: data.excerpt || null,
        category_id: data.category_id || null,
        page_context: data.page_context || null,
        target_role: data.target_role || "all",
        language: data.language || "en",
        is_published: data.is_published !== false,
        sort_order: data.sort_order ?? 0,
        created_by: createdBy,
      },
    });
  },

  async updateArticle(id: string, data: Record<string, unknown>) {
    const allowed = [
      "title",
      "content",
      "excerpt",
      "category_id",
      "page_context",
      "target_role",
      "language",
      "is_published",
      "sort_order",
    ];
    const patch: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in data) patch[key] = data[key];
    }
    try {
      return await prisma.helpArticle.update({ where: { id }, data: patch });
    } catch {
      return null;
    }
  },

  async deleteArticle(id: string) {
    await prisma.helpArticle.delete({ where: { id } }).catch(() => {});
  },

  async createCategory(data: {
    name: string;
    description?: string | null;
    icon?: string | null;
    sort_order?: number;
  }) {
    return prisma.helpCategory.create({
      data: {
        name: data.name,
        description: data.description || null,
        icon: data.icon || null,
        sort_order: data.sort_order ?? 0,
      },
    });
  },

  async updateCategory(id: string, data: Record<string, unknown>) {
    const allowed = ["name", "description", "icon", "sort_order"];
    const patch: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in data) patch[key] = data[key];
    }
    try {
      return await prisma.helpCategory.update({ where: { id }, data: patch });
    } catch {
      return null;
    }
  },

  async deleteCategory(id: string) {
    await prisma.helpCategory.delete({ where: { id } }).catch(() => {});
  },
};
