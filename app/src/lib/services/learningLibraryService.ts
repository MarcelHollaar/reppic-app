/**
 * Kennisbibliotheek (LMS-integratie, uitbreiding B) — de betaalde add-on
 * (gate = Company.has_knowledge_access, beslissing B5).
 *
 * Geport uit het oude LMS (/api/library/*): bedrijfsgebonden documenten-
 * repository met categorieën, favorieten en zoeken. Semantisch zoeken loopt
 * via learningEmbeddingsService (optioneel; valt terug op tekstzoeken).
 *
 * Bestanden gaan via de bestaande saveFileToFtp-helper (zelfde patroon als
 * avatars/thumbnails); URL's via getFullUrl.
 */
import { prisma } from "@/app/api/utils/prisma";
import {
  saveFileToFtp,
  deleteFile,
  sanitizePathSegment,
} from "@/app/api/utils/fileStorage";
import { getFullUrl } from "@/app/api/utils/urlHelper";
import {
  extractTextForIndex,
  indexLibraryDocument,
  semanticSearchLibrary,
} from "@/lib/services/learningEmbeddingsService";
import {
  AuthUser,
  isSuperAdmin,
  isLearningAdmin,
} from "@/lib/services/learningService";

type Result<T> = { data: T } | { error: "forbidden" | "not_found" | "invalid" | "no_knowledge_access" };

/**
 * Bepaal het bedrijf waarvoor de bibliotheek wordt geopend en of dat mag.
 * - Gewone gebruiker/learning_admin: eigen bedrijf, mits has_knowledge_access.
 * - Superadmin: mag elk bedrijf inzien via expliciete companyId.
 */
async function resolveLibraryCompany(
  user: AuthUser,
  companyIdParam?: string | null,
): Promise<{ companyId: string } | { error: "forbidden" | "no_knowledge_access" }> {
  const companyId = isSuperAdmin(user)
    ? companyIdParam || user.company_id
    : user.company_id;
  if (!companyId) return { error: "forbidden" };

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { has_knowledge_access: true },
  });
  if (!company) return { error: "forbidden" };
  if (!company.has_knowledge_access && !isSuperAdmin(user)) {
    return { error: "no_knowledge_access" };
  }
  return { companyId };
}

function docWithUrls<T extends { file_url: string | null }>(doc: T): T {
  return {
    ...doc,
    // Externe links en al-volledige URL's ongemoeid laten; FTP-paden voorzien
    // van de publieke basis-URL.
    file_url:
      doc.file_url && !doc.file_url.startsWith("http")
        ? getFullUrl(doc.file_url)
        : doc.file_url,
  };
}

export const learningLibraryService = {
  // ─────────────────────────── Categorieën ───────────────────────────

  async getCategories(user: AuthUser, companyIdParam?: string | null) {
    const scope = await resolveLibraryCompany(user, companyIdParam);
    if ("error" in scope) return scope;
    const data = await prisma.libraryCategory.findMany({
      where: { company_id: scope.companyId },
      include: { _count: { select: { documents: true } } },
      orderBy: [{ sort_order: "asc" }, { name: "asc" }],
    });
    return { data };
  },

  async upsertCategory(
    user: AuthUser,
    data: { id?: string; name: string; description?: string | null; icon?: string | null },
    companyIdParam?: string | null,
  ): Promise<Result<any>> {
    if (!isLearningAdmin(user)) return { error: "forbidden" };
    if (!data.name?.trim()) return { error: "invalid" };
    const scope = await resolveLibraryCompany(user, companyIdParam);
    if ("error" in scope) return scope;

    if (data.id) {
      const existing = await prisma.libraryCategory.findUnique({
        where: { id: data.id },
        select: { company_id: true },
      });
      if (!existing || existing.company_id !== scope.companyId) {
        return { error: "not_found" };
      }
      const updated = await prisma.libraryCategory.update({
        where: { id: data.id },
        data: {
          name: data.name.trim(),
          description: data.description || null,
          icon: data.icon || null,
        },
      });
      return { data: updated };
    }

    const created = await prisma.libraryCategory.create({
      data: {
        name: data.name.trim(),
        description: data.description || null,
        icon: data.icon || null,
        company_id: scope.companyId,
        created_by: user.id,
      },
    });
    return { data: created };
  },

  async deleteCategory(
    user: AuthUser,
    categoryId: string,
    companyIdParam?: string | null,
  ): Promise<Result<true>> {
    if (!isLearningAdmin(user)) return { error: "forbidden" };
    const scope = await resolveLibraryCompany(user, companyIdParam);
    if ("error" in scope) return scope;
    const existing = await prisma.libraryCategory.findUnique({
      where: { id: categoryId },
      select: { company_id: true },
    });
    if (!existing || existing.company_id !== scope.companyId) {
      return { error: "not_found" };
    }
    await prisma.libraryCategory.delete({ where: { id: categoryId } });
    return { data: true };
  },

  // ─────────────────────────── Documenten ───────────────────────────

  async getDocuments(
    user: AuthUser,
    filters: { search?: string; categoryId?: string; companyId?: string | null } = {},
  ) {
    const scope = await resolveLibraryCompany(user, filters.companyId);
    if ("error" in scope) return scope;

    const where: any = { company_id: scope.companyId };
    // Alleen beheerders zien onzichtbaar-gemaakte (concept)documenten.
    if (!isLearningAdmin(user)) where.is_published = true;
    if (filters.categoryId) where.category_id = filters.categoryId;

    // Semantisch zoeken (AI-uitbreiding) als embeddings beschikbaar zijn;
    // anders klassiek tekstzoeken op titel/omschrijving.
    let semanticOrder: string[] | null = null;
    if (filters.search?.trim()) {
      const term = filters.search.trim();
      semanticOrder = await semanticSearchLibrary(scope.companyId, term);
      if (semanticOrder && semanticOrder.length > 0) {
        where.id = { in: semanticOrder };
      } else {
        semanticOrder = null;
        where.OR = [
          { title: { contains: term, mode: "insensitive" } },
          { description: { contains: term, mode: "insensitive" } },
        ];
      }
    }

    const [documents, favorites] = await Promise.all([
      prisma.libraryDocument.findMany({
        where,
        include: { category: { select: { id: true, name: true } } },
        orderBy: { created_at: "desc" },
      }),
      prisma.libraryFavorite.findMany({
        where: { user_id: user.id },
        select: { document_id: true },
      }),
    ]);
    const favoriteIds = new Set(favorites.map((f) => f.document_id));
    let ordered = documents;
    if (semanticOrder) {
      const rank = new Map(semanticOrder.map((id, i) => [id, i]));
      ordered = [...documents].sort(
        (a, b) => (rank.get(a.id) ?? 999) - (rank.get(b.id) ?? 999),
      );
    }
    return {
      data: ordered.map((d) => ({
        ...docWithUrls(d),
        is_favorite: favoriteIds.has(d.id),
        semantic: Boolean(semanticOrder),
      })),
    };
  },

  /** Documentdetail; verhoogt de view-teller. */
  async getDocument(user: AuthUser, documentId: string, companyIdParam?: string | null) {
    const scope = await resolveLibraryCompany(user, companyIdParam);
    if ("error" in scope) return scope;
    const doc = await prisma.libraryDocument.findUnique({
      where: { id: documentId },
      include: { category: { select: { id: true, name: true } } },
    });
    if (!doc || doc.company_id !== scope.companyId) return { error: "not_found" as const };
    if (!doc.is_published && !isLearningAdmin(user)) return { error: "not_found" as const };
    await prisma.libraryDocument.update({
      where: { id: documentId },
      data: { view_count: { increment: 1 } },
    });
    return { data: docWithUrls(doc) };
  },

  /**
   * Document aanmaken/bijwerken. `file` (optioneel) wordt naar de bestaande
   * opslag geschreven onder learning-library/<companyId>/.
   */
  async upsertDocument(
    user: AuthUser,
    data: {
      id?: string;
      title: string;
      description?: string | null;
      category_id?: string | null;
      content_type?: string; // 'document' | 'video' | 'presentation' | 'link'
      external_url?: string | null;
      tags?: string[] | null;
      is_published?: boolean;
    },
    file?: { buffer: ArrayBuffer; name: string; mimeType: string; size: number } | null,
    companyIdParam?: string | null,
  ): Promise<Result<any>> {
    if (!isLearningAdmin(user)) return { error: "forbidden" };
    if (!data.title?.trim()) return { error: "invalid" };
    const scope = await resolveLibraryCompany(user, companyIdParam);
    if ("error" in scope) return scope;

    const contentType = ["document", "video", "presentation", "link"].includes(
      data.content_type || "",
    )
      ? (data.content_type as string)
      : "document";

    let fileFields: any = {};
    if (file) {
      const folder = `learning-library/${sanitizePathSegment(scope.companyId, "company")}`;
      const storedPath = await saveFileToFtp(file.buffer, file.name, folder);
      fileFields = {
        file_url: storedPath,
        mime_type: file.mimeType,
        file_size: file.size,
      };
    }

    const docData = {
      title: data.title.trim(),
      description: data.description || null,
      category_id: data.category_id || null,
      content_type: contentType,
      external_url: contentType === "link" ? data.external_url || null : null,
      tags: Array.isArray(data.tags) ? data.tags : undefined,
      is_published: data.is_published !== false,
      ...fileFields,
    };

    if (data.id) {
      const existing = await prisma.libraryDocument.findUnique({
        where: { id: data.id },
        select: { company_id: true, file_url: true },
      });
      if (!existing || existing.company_id !== scope.companyId) {
        return { error: "not_found" };
      }
      // Oud bestand opruimen als er een nieuw bestand is geüpload.
      if (file && existing.file_url && !existing.file_url.startsWith("http")) {
        await deleteFile(existing.file_url).catch(() => {});
      }
      const updated = await prisma.libraryDocument.update({
        where: { id: data.id },
        data: docData,
      });
      // Herindexeren voor semantisch zoeken (fire-and-forget, faalt stil).
      extractTextForIndex(file || null, {
        title: docData.title,
        description: docData.description,
        tags: Array.isArray(data.tags) ? data.tags : null,
      })
        .then((text) =>
          indexLibraryDocument(updated.id, scope.companyId, text),
        )
        .catch(() => {});
      return { data: docWithUrls(updated) };
    }

    const created = await prisma.libraryDocument.create({
      data: {
        ...docData,
        company_id: scope.companyId,
        uploaded_by: user.id,
      },
    });
    // Indexeren voor semantisch zoeken (fire-and-forget, faalt stil).
    extractTextForIndex(file || null, {
      title: docData.title,
      description: docData.description,
      tags: Array.isArray(data.tags) ? data.tags : null,
    })
      .then((text) => indexLibraryDocument(created.id, scope.companyId, text))
      .catch(() => {});
    return { data: docWithUrls(created) };
  },

  async deleteDocument(
    user: AuthUser,
    documentId: string,
    companyIdParam?: string | null,
  ): Promise<Result<true>> {
    if (!isLearningAdmin(user)) return { error: "forbidden" };
    const scope = await resolveLibraryCompany(user, companyIdParam);
    if ("error" in scope) return scope;
    const existing = await prisma.libraryDocument.findUnique({
      where: { id: documentId },
      select: { company_id: true, file_url: true },
    });
    if (!existing || existing.company_id !== scope.companyId) {
      return { error: "not_found" };
    }
    if (existing.file_url && !existing.file_url.startsWith("http")) {
      await deleteFile(existing.file_url).catch(() => {});
    }
    await prisma.libraryDocument.delete({ where: { id: documentId } });
    return { data: true };
  },

  // ─────────────────────────── Favorieten ───────────────────────────

  async toggleFavorite(
    user: AuthUser,
    documentId: string,
  ): Promise<Result<{ is_favorite: boolean }>> {
    const doc = await prisma.libraryDocument.findUnique({
      where: { id: documentId },
      select: { company_id: true },
    });
    if (!doc) return { error: "not_found" };
    if (!isSuperAdmin(user) && doc.company_id !== user.company_id) {
      return { error: "forbidden" };
    }
    const existing = await prisma.libraryFavorite.findUnique({
      where: {
        library_favorite_unique: { user_id: user.id, document_id: documentId },
      },
    });
    if (existing) {
      await prisma.libraryFavorite.delete({ where: { id: existing.id } });
      return { data: { is_favorite: false } };
    }
    await prisma.libraryFavorite.create({
      data: { user_id: user.id, document_id: documentId },
    });
    return { data: { is_favorite: true } };
  },
};
