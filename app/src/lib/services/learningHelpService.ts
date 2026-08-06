/**
 * Help-center (LMS 1:1 P3) — port van productie storage.ts help-functies +
 * /api/help/* routes. Artikelen gefilterd op rol (all/learner/admin), taal en
 * optionele paginacontext; beheer (CRUD) voor learning_admin/superadmin.
 */
import { prisma } from "@/app/api/utils/prisma";

export type HelpRole = "all" | "learner" | "admin";

/**
 * LMS-rol van de app-gebruiker → help-doelrol (zoals productie req.user.role).
 * `role` mag zowel een string ("superadmin") als het Prisma-object ({name})
 * uit de auth-middleware zijn — voorheen crashte `.includes` op het object,
 * waardoor het helpcentrum voor gewone learners een 500 gaf.
 */
export function helpRoleFor(user: {
  learning_role?: string | null;
  role?: string | { name?: string | null } | null;
}): HelpRole {
  const lr = (user.learning_role || "").toLowerCase();
  const roleName = (
    (typeof user.role === "string" ? user.role : user.role?.name) || ""
  ).toLowerCase();
  if (lr.includes("admin") || roleName.includes("admin")) {
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

  /**
   * Enkel artikel + view-teller ophogen (zoals productie).
   * Publicatie-/rolcheck: een learner mag via een direct/geraden id géén
   * concept- (niet-gepubliceerd) of admin-only artikel ophalen. Een admin
   * (learning_admin/superadmin) mag alles zien, o.a. voor preview.
   */
  async getArticle(id: string, role: HelpRole = "learner") {
    const article = await prisma.helpArticle.findUnique({ where: { id } });
    if (!article) return null;
    if (role !== "admin") {
      const roleOk =
        article.target_role === role || article.target_role === "all";
      if (!article.is_published || !roleOk) return null;
    }
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
