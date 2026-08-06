/**
 * Leerpaden + functierollen (LMS-integratie, uitbreiding B).
 *
 * Geport uit het oude LMS (server/routes.ts: /api/learning-paths,
 * /api/job-roles, /api/modules/:id/job-roles) op het app-rolmodel:
 * - superadmin: globale leerpaden/functierollen (company_id NULL) + alles zien;
 * - learning_admin: alleen eigen bedrijf (ziet eigen + globale);
 * - leerpad toewijzen aan een medewerker materialiseert de modules van dat pad
 *   óók als module-toewijzingen, zodat de learner ze direct op /learning ziet.
 */
import { prisma } from "@/app/api/utils/prisma";
import { completeChat } from "@/app/api/services/litellmClient";
import { getLmsChatRoute } from "@/app/api/services/learningModelSettingsService";
import { PLATFORM_SETTING_KEYS } from "@/configs/constants";
import {
  AuthUser,
  isSuperAdmin,
  isLearningAdmin,
  companyLmsEnabled,
} from "@/lib/services/learningService";

type Result<T> = { data: T } | { error: "forbidden" | "not_found" | "invalid" };

/** Scope-check: mag deze gebruiker dit (globale of bedrijfs-)object beheren? */
function mayManageScoped(user: AuthUser, companyId: string | null): boolean {
  if (isSuperAdmin(user)) return true;
  // learning_admin: alleen objecten van het eigen bedrijf, nooit globale.
  return companyId !== null && companyId === user.company_id;
}

/**
 * Scope-check: mag deze gebruiker naar dit (globale of bedrijfs-)object VERWIJZEN?
 * Ruimer dan mayManageScoped: globale objecten (company_id NULL) mogen worden
 * gekoppeld, maar niet bewerkt. Voorkomt cross-tenant koppelingen aan een
 * geraden id van een ander bedrijf.
 */
function mayReferenceScoped(user: AuthUser, companyId: string | null): boolean {
  if (isSuperAdmin(user)) return true;
  return companyId === null || companyId === user.company_id;
}

/**
 * Filtert een lijst module-id's tot alleen de modules die deze gebruiker mag
 * zien (globaal + eigen bedrijf indien lms_enabled), met behoud van volgorde.
 * Onbekende of vreemd-bedrijf-id's vallen stil weg — zelfde gedrag als
 * createPathFromAnalysis, zodat een geraden id van bedrijf B nooit koppelt.
 */
async function scopeModuleIds(user: AuthUser, ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const includeCompany = isSuperAdmin(user)
    ? false
    : await companyLmsEnabled(user.company_id);
  const where = isSuperAdmin(user)
    ? { id: { in: ids }, deleted_at: null }
    : {
        id: { in: ids },
        deleted_at: null,
        OR: [
          { company_id: null },
          ...(includeCompany ? [{ company_id: user.company_id }] : []),
        ],
      };
  const found = await prisma.learningModule.findMany({
    where,
    select: { id: true },
  });
  const ok = new Set(found.map((m) => m.id));
  return ids.filter((id) => ok.has(id));
}

export const learningPathsService = {
  // ─────────────────────────── Leerpaden ───────────────────────────

  /** Zichtbare leerpaden: globaal + eigen bedrijf, met modules en aantallen. */
  async getPaths(user: AuthUser) {
    const where = isSuperAdmin(user)
      ? {}
      : { OR: [{ company_id: null }, { company_id: user.company_id }] };
    return prisma.learningPath.findMany({
      where,
      include: {
        job_role: { select: { id: true, name: true } },
        path_modules: {
          orderBy: { order_index: "asc" },
          include: {
            module: {
              select: {
                id: true,
                title: true,
                learning_path_type: true,
                phase: true,
                duration: true,
                deleted_at: true,
              },
            },
          },
        },
        _count: { select: { path_assignments: true } },
      },
      orderBy: { created_at: "asc" },
    });
  },

  async getPath(user: AuthUser, pathId: string) {
    const paths = await this.getPaths(user);
    return paths.find((p) => p.id === pathId) || null;
  },

  async upsertPath(
    user: AuthUser,
    data: {
      id?: string;
      job_function: string;
      level?: string;
      description?: string | null;
      job_role_id?: string | null;
      module_ids?: string[]; // volledige, geordende lijst
    },
  ): Promise<Result<any>> {
    if (!isLearningAdmin(user)) return { error: "forbidden" };
    if (!data.job_function?.trim()) return { error: "invalid" };

    // Tenant-check op de gekoppelde functierol: mag globaal of eigen bedrijf zijn,
    // nooit een (geraden) functierol van een ander bedrijf.
    if (data.job_role_id) {
      const jr = await prisma.jobRole.findUnique({
        where: { id: data.job_role_id },
        select: { company_id: true },
      });
      if (!jr || !mayReferenceScoped(user, jr.company_id)) {
        return { error: "forbidden" };
      }
    }

    let path;
    if (data.id) {
      const existing = await prisma.learningPath.findUnique({
        where: { id: data.id },
        select: { company_id: true },
      });
      if (!existing) return { error: "not_found" };
      if (!mayManageScoped(user, existing.company_id)) {
        return { error: "forbidden" };
      }
      path = await prisma.learningPath.update({
        where: { id: data.id },
        data: {
          job_function: data.job_function.trim(),
          level: data.level?.trim() || "basis",
          description: data.description || null,
          job_role_id: data.job_role_id || null,
        },
      });
    } else {
      path = await prisma.learningPath.create({
        data: {
          job_function: data.job_function.trim(),
          level: data.level?.trim() || "basis",
          description: data.description || null,
          job_role_id: data.job_role_id || null,
          // superadmin bouwt globale paden; learning_admin voor eigen bedrijf
          company_id: isSuperAdmin(user) ? null : user.company_id,
        },
      });
    }

    // Modules volledig vervangen in de opgegeven volgorde (indien meegestuurd).
    // Eerst tot de zichtbare set scopen zodat een geraden module-id van een
    // ander bedrijf niet gekoppeld kan worden (metadata-lek via getPath).
    if (Array.isArray(data.module_ids)) {
      const allowedIds = await scopeModuleIds(user, data.module_ids);
      await prisma.learningPathModule.deleteMany({
        where: { learning_path_id: path.id },
      });
      for (let i = 0; i < allowedIds.length; i++) {
        await prisma.learningPathModule.create({
          data: {
            learning_path_id: path.id,
            module_id: allowedIds[i],
            order_index: i,
          },
        });
      }
    }

    return { data: path };
  },

  async deletePath(user: AuthUser, pathId: string): Promise<Result<true>> {
    if (!isLearningAdmin(user)) return { error: "forbidden" };
    const existing = await prisma.learningPath.findUnique({
      where: { id: pathId },
      select: { company_id: true },
    });
    if (!existing) return { error: "not_found" };
    if (!mayManageScoped(user, existing.company_id)) {
      return { error: "forbidden" };
    }
    await prisma.learningPath.delete({ where: { id: pathId } });
    return { data: true };
  },

  /**
   * Leerpad toewijzen aan een medewerker. Materialiseert de modules van het
   * pad als individuele module-toewijzingen (assigned_by = toewijzer), zodat
   * voortgang per module gewoon via de bestaande flow loopt.
   */
  async assignPathToUser(
    user: AuthUser,
    targetUserId: string,
    pathId: string,
  ): Promise<Result<any>> {
    if (!isLearningAdmin(user)) return { error: "forbidden" };

    const target = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { company_id: true, role: { select: { name: true } } },
    });
    if (!target) return { error: "not_found" };
    if (!isSuperAdmin(user) && target.company_id !== user.company_id) {
      return { error: "forbidden" };
    }

    const path = await prisma.learningPath.findUnique({
      where: { id: pathId },
      include: { path_modules: { select: { module_id: true } } },
    });
    if (!path) return { error: "not_found" };
    // Pad moet zichtbaar zijn voor het bedrijf van de doelgebruiker.
    if (path.company_id && path.company_id !== target.company_id) {
      return { error: "forbidden" };
    }

    const assignment = await prisma.userLearningPathAssignment.upsert({
      where: {
        user_learning_path_assignment_unique: {
          user_id: targetUserId,
          learning_path_id: pathId,
        },
      },
      update: {},
      create: {
        user_id: targetUserId,
        learning_path_id: pathId,
        assigned_by: user.id,
      },
    });

    for (const pm of path.path_modules) {
      await prisma.userModuleAssignment.upsert({
        where: {
          user_module_assignment_unique: {
            user_id: targetUserId,
            module_id: pm.module_id,
          },
        },
        update: {},
        create: {
          user_id: targetUserId,
          module_id: pm.module_id,
          assigned_by: user.id,
          is_required: true,
        },
      });
    }

    return { data: assignment };
  },

  async removePathFromUser(
    user: AuthUser,
    targetUserId: string,
    pathId: string,
  ): Promise<Result<true>> {
    if (!isLearningAdmin(user)) return { error: "forbidden" };
    const target = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { company_id: true },
    });
    if (!target) return { error: "not_found" };
    if (!isSuperAdmin(user) && target.company_id !== user.company_id) {
      return { error: "forbidden" };
    }
    // Alleen de pad-toewijzing verwijderen; module-toewijzingen (en voortgang)
    // blijven staan — voortgang weggooien is destructief en onverwacht.
    await prisma.userLearningPathAssignment.deleteMany({
      where: { user_id: targetUserId, learning_path_id: pathId },
    });
    return { data: true };
  },

  /**
   * AI-leerpadgeneratie uit een functieprofiel (AI-uitbreiding, deel 2 —
   * port van het oude LMS analyze-job-profile/create-from-analysis, maar via
   * de bestaande LiteLLM-gateway i.p.v. een losse OpenAI-key).
   *
   * De LLM kiest en ordent modules UITSLUITEND uit de meegegeven lijst
   * (zichtbare modules voor deze beheerder); het resultaat wordt als leerpad
   * opgeslagen en kan daarna gewoon worden bewerkt.
   */
  async generatePathFromProfile(
    user: AuthUser,
    input: { job_profile_text: string; language?: string },
  ): Promise<Result<{ path: any; rationale: string }>> {
    if (!isLearningAdmin(user)) return { error: "forbidden" };
    const profileText = input.job_profile_text?.trim();
    if (!profileText || profileText.length < 40) return { error: "invalid" };

    // Zichtbare, niet-verwijderde modules als kandidatenlijst.
    const moduleWhere = isSuperAdmin(user)
      ? { deleted_at: null }
      : {
          deleted_at: null,
          OR: [{ company_id: null }, { company_id: user.company_id }],
        };
    const candidates = await prisma.learningModule.findMany({
      where: moduleWhere,
      select: {
        id: true,
        title: true,
        description: true,
        learning_path_type: true,
        phase: true,
        duration: true,
      },
      orderBy: [{ phase: "asc" }, { created_at: "asc" }],
    });
    if (candidates.length === 0) return { error: "invalid" };

    const lang = input.language === "en" ? "English" : "Dutch";
    const moduleList = candidates
      .map(
        (m) =>
          `- id: ${m.id} | titel: ${m.title} | type: ${m.learning_path_type}` +
          `${m.phase != null ? ` | gespreksfase: ${m.phase}` : ""}` +
          `${m.description ? ` | omschrijving: ${m.description.slice(0, 200)}` : ""}`,
      )
      .join("\n");

    const prompt = `Je bent een leerplan-expert voor salesteams. Op basis van onderstaand functieprofiel stel je een leerpad samen uit de beschikbare leermodules.

FUNCTIEPROFIEL:
"""
${profileText.slice(0, 6000)}
"""

BESCHIKBARE MODULES (kies UITSLUITEND uit deze lijst, gebruik de exacte id's):
${moduleList}

Geef je antwoord als JSON-object met exact deze velden:
{
  "job_function": "korte functienaam afgeleid uit het profiel",
  "level": "basis" | "gevorderd",
  "description": "1-2 zinnen in het ${lang} waarom dit pad bij dit profiel past",
  "module_ids": ["id", ...]  // 3 tot 8 module-id's uit de lijst, in logische leervolgorde,
  "rationale": "korte toelichting in het ${lang} per gekozen module (1 regel per module)"
}
Kies alleen modules die echt relevant zijn voor het profiel; minder is beter dan alles.`;

    let parsed: {
      job_function?: string;
      level?: string;
      description?: string;
      module_ids?: string[];
      rationale?: string;
    };
    try {
      // Superadmin-gekozen model voor leerpadgeneratie (leeg = env-default).
      const chatRoute = await getLmsChatRoute(
        PLATFORM_SETTING_KEYS.LMS_PATHGEN_LITELLM_MODEL,
      );
      const raw = await completeChat(prompt, { userId: user.id }, chatRoute);
      // Sommige gateway-modellen leveren JSON in markdown-fences (```json …```)
      // ondanks response_format; strip die vóór het parsen.
      const cleaned = raw
        .trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/, "");
      parsed = JSON.parse(cleaned);
    } catch (err) {
      console.error("[learning] AI-leerpadgeneratie mislukt:", err);
      return { error: "invalid" };
    }

    // Alleen id's accepteren die echt in de kandidatenlijst zitten.
    const validIds = new Set(candidates.map((m) => m.id));
    const moduleIds = (parsed.module_ids || []).filter((id) =>
      validIds.has(id),
    );
    if (moduleIds.length === 0) return { error: "invalid" };

    const created = await this.upsertPath(user, {
      job_function: parsed.job_function?.trim() || "AI-leerpad",
      level: parsed.level === "gevorderd" ? "gevorderd" : "basis",
      description: parsed.description || null,
      module_ids: moduleIds,
    });
    if ("error" in created) return created;

    return {
      data: { path: created.data, rationale: parsed.rationale || "" },
    };
  },

  // ─────────────────────────── Functierollen ───────────────────────────

  /** Zichtbare functierollen: globale templates + eigen bedrijf. */
  async getJobRoles(user: AuthUser) {
    const where = isSuperAdmin(user)
      ? {}
      : { OR: [{ company_id: null }, { company_id: user.company_id }] };
    return prisma.jobRole.findMany({
      where,
      include: { _count: { select: { module_job_roles: true, learning_paths: true } } },
      orderBy: [{ scope: "asc" }, { name: "asc" }],
    });
  },

  async upsertJobRole(
    user: AuthUser,
    data: {
      id?: string;
      name: string;
      description?: string | null;
      scope?: string; // 'global' | 'company'
    },
  ): Promise<Result<any>> {
    if (!isLearningAdmin(user)) return { error: "forbidden" };
    if (!data.name?.trim()) return { error: "invalid" };

    // Alleen superadmin mag globale functierollen maken/omzetten.
    const wantsGlobal = data.scope === "global";
    if (wantsGlobal && !isSuperAdmin(user)) return { error: "forbidden" };

    if (data.id) {
      const existing = await prisma.jobRole.findUnique({
        where: { id: data.id },
        select: { company_id: true },
      });
      if (!existing) return { error: "not_found" };
      if (!mayManageScoped(user, existing.company_id)) {
        return { error: "forbidden" };
      }
      const updated = await prisma.jobRole.update({
        where: { id: data.id },
        data: {
          name: data.name.trim(),
          description: data.description || null,
          ...(isSuperAdmin(user) && data.scope
            ? {
                scope: wantsGlobal ? "global" : "company",
                company_id: wantsGlobal ? null : existing.company_id,
              }
            : {}),
        },
      });
      return { data: updated };
    }

    const created = await prisma.jobRole.create({
      data: {
        name: data.name.trim(),
        description: data.description || null,
        scope: wantsGlobal ? "global" : "company",
        company_id: wantsGlobal
          ? null
          : isSuperAdmin(user)
            ? null // superadmin zonder bedrijf: maak globaal tenzij expliciet anders
            : user.company_id,
      },
    });
    return { data: created };
  },

  async deleteJobRole(user: AuthUser, jobRoleId: string): Promise<Result<true>> {
    if (!isLearningAdmin(user)) return { error: "forbidden" };
    const existing = await prisma.jobRole.findUnique({
      where: { id: jobRoleId },
      select: { company_id: true },
    });
    if (!existing) return { error: "not_found" };
    if (!mayManageScoped(user, existing.company_id)) {
      return { error: "forbidden" };
    }
    await prisma.jobRole.delete({ where: { id: jobRoleId } });
    return { data: true };
  },

  // ─────────────── Module ↔ functierol (verplicht/aanbevolen) ───────────────

  async getModuleJobRoles(user: AuthUser, moduleId: string) {
    if (!isLearningAdmin(user)) return null;
    // Tenant-check: alleen functierollen van een module die deze beheerder mag
    // zien (globaal of eigen bedrijf). Zonder deze check zou een learning_admin
    // via een geraden module-id de functierol-namen van een ander bedrijf zien.
    const learningModule = await prisma.learningModule.findUnique({
      where: { id: moduleId },
      select: { company_id: true },
    });
    if (!learningModule) return null;
    if (!mayReferenceScoped(user, learningModule.company_id)) return null;
    return prisma.moduleJobRole.findMany({
      where: { module_id: moduleId },
      include: { job_role: { select: { id: true, name: true, scope: true } } },
    });
  },

  /** Vervangt de functierol-koppelingen van een module volledig. */
  async setModuleJobRoles(
    user: AuthUser,
    moduleId: string,
    couplings: Array<{ job_role_id: string; visibility?: string }>,
  ): Promise<Result<any[]>> {
    if (!isLearningAdmin(user)) return { error: "forbidden" };
    const learningModule = await prisma.learningModule.findUnique({
      where: { id: moduleId },
      select: { company_id: true, learning_path_type: true },
    });
    if (!learningModule) return { error: "not_found" };
    if (!isSuperAdmin(user)) {
      if (
        learningModule.company_id !== user.company_id ||
        learningModule.learning_path_type === "sales_skills"
      ) {
        return { error: "forbidden" };
      }
    }

    await prisma.moduleJobRole.deleteMany({ where: { module_id: moduleId } });
    const created = [];
    for (const c of couplings) {
      if (!c.job_role_id) continue;
      created.push(
        await prisma.moduleJobRole.create({
          data: {
            module_id: moduleId,
            job_role_id: c.job_role_id,
            visibility: c.visibility === "recommended" ? "recommended" : "required",
          },
        }),
      );
    }
    return { data: created };
  },
};
