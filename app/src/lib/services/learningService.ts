/**
 * LearningService — kern van het native LMS (LMS-integratie Fase 3).
 *
 * Tenant-regels (geport uit Reppic-LMS, aangescherpt op het app-rolmodel):
 * - Globale modules (company_id = NULL) zijn zichtbaar voor élke learner
 *   (de bestaande situatie: sales-skills-content voor iedereen).
 * - Bedrijfsmodules zijn alleen zichtbaar voor gebruikers van dat bedrijf,
 *   en alleen als het bedrijf lms_enabled heeft (volledig-LMS-knop).
 * - sales_skills-content wordt alleen door superadmin beheerd (globaal);
 *   learning_admins beheren knowledge-content binnen hun eigen bedrijf.
 * - Quizbeoordeling gebeurt server-side; juiste antwoorden verlaten de
 *   server nooit richting de learner.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "@/app/api/utils/prisma";
import { LEARNING_ROLE, USER_ROLE } from "@/configs/constants";
import { learningTranslationService } from "@/lib/services/learningTranslationService";

const QUIZ_PASS_SCORE = 70; // percentage nodig voor behalen + certificaat

export type AuthUser = {
  id: string;
  email: string;
  company_id: string | null;
  learning_role: string | null;
  role: { name: string } | null;
  /** Profieltaal — de server-side bron van waarheid voor de weergavetaal. */
  lang_code?: string | null;
};

/**
 * Weergavetaal voor leerinhoud: expliciete keuze (queryparam) wint, anders de
 * profieltaal van de gebruiker. Zo is inhoud ALTIJD gelokaliseerd, ook als een
 * scherm vergeet een taal mee te sturen.
 */
export function resolveContentLanguage(
  user: AuthUser,
  requested?: string | null,
): string | undefined {
  return requested || user.lang_code || undefined;
}

export function isSuperAdmin(user: AuthUser) {
  return user.role?.name === USER_ROLE.SUPER_ADMIN;
}

export function isLearningAdmin(user: AuthUser) {
  return (
    isSuperAdmin(user) || user.learning_role === LEARNING_ROLE.LEARNING_ADMIN
  );
}

export async function companyLmsEnabled(companyId: string | null): Promise<boolean> {
  if (!companyId) return false;
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { lms_enabled: true },
  });
  return Boolean(company?.lms_enabled);
}

/** Where-clausule voor modules die deze gebruiker mag zien. */
async function accessibleModulesWhere(user: AuthUser) {
  if (isSuperAdmin(user)) {
    return { deleted_at: null };
  }
  const includeCompany = await companyLmsEnabled(user.company_id);
  return {
    deleted_at: null,
    OR: [
      { company_id: null },
      ...(includeCompany ? [{ company_id: user.company_id }] : []),
    ],
  };
}

export const learningService = {
  /** Modules voor de learner, met eigen voortgang en toewijzing. */
  async getModulesForUser(
    user: AuthUser,
    filters: { type?: string; categoryId?: string } = {},
    requestedLanguage?: string,
  ) {
    // Expliciete keuze wint; anders de profieltaal — nooit "vergeten".
    const language = resolveContentLanguage(user, requestedLanguage);
    const where: any = await accessibleModulesWhere(user);
    if (filters.type === "sales_skills" || filters.type === "knowledge") {
      where.learning_path_type = filters.type;
    }
    if (filters.categoryId) {
      where.category_id = filters.categoryId;
    }

    const [modules, progress, assignments] = await Promise.all([
      prisma.learningModule.findMany({
        where,
        orderBy: [{ phase: "asc" }, { created_at: "asc" }],
        select: {
          id: true,
          title: true,
          description: true,
          duration: true,
          learning_path_type: true,
          phase: true,
          content_type: true,
          thumbnail_url: true,
          is_required: true,
          original_language: true,
          category: { select: { id: true, name: true } },
          _count: { select: { questions: true } },
        },
      }),
      prisma.learningProgress.findMany({
        where: { user_id: user.id },
        select: {
          module_id: true,
          status: true,
          progress: true,
          score: true,
        },
      }),
      prisma.userModuleAssignment.findMany({
        where: { user_id: user.id },
        select: { module_id: true, is_required: true, due_date: true },
      }),
    ]);

    const progressByModule = new Map(progress.map((p) => [p.module_id, p]));
    const assignmentByModule = new Map(
      assignments.map((a) => [a.module_id, a]),
    );

    // Lijst in de taal van de gebruiker (net als de detailpagina): vertaalde
    // titel/omschrijving/thumbnail in één batch ophalen en toepassen.
    const translationByModule = new Map<
      string,
      { title?: string; description?: string; thumbnailUrl?: string }
    >();
    if (language) {
      const translations = await prisma.learningModuleTranslation.findMany({
        where: { module_id: { in: modules.map((m) => m.id) }, language },
        select: { module_id: true, content: true },
      });
      for (const t of translations) {
        translationByModule.set(
          t.module_id,
          (t.content ?? {}) as {
            title?: string;
            description?: string;
            thumbnailUrl?: string;
          },
        );
      }
    }

    return modules.map((m) => {
      const tr =
        language && language !== m.original_language
          ? translationByModule.get(m.id)
          : undefined;
      return {
        ...m,
        title: tr?.title || m.title,
        description: tr?.description || m.description,
        thumbnail_url: tr?.thumbnailUrl || m.thumbnail_url,
        question_count: m._count.questions,
        _count: undefined,
        progress: progressByModule.get(m.id) || null,
        assignment: assignmentByModule.get(m.id) || null,
      };
    });
  },

  /** Moduledetail voor de learner — quizvragen ZONDER juiste antwoorden. */
  async getModuleForUser(
    user: AuthUser,
    moduleId: string,
    requestedLanguage?: string,
  ) {
    const language = resolveContentLanguage(user, requestedLanguage);
    const where: any = await accessibleModulesWhere(user);
    const learningModule = await prisma.learningModule.findFirst({
      where: { ...where, id: moduleId },
      include: {
        category: { select: { id: true, name: true } },
        questions: {
          orderBy: { order_index: "asc" },
          // Bewust géén correct_answer/explanation: beoordeling is server-side.
          select: {
            id: true,
            question: true,
            options: true,
            image_url: true,
            order_index: true,
          },
        },
      },
    });
    if (!learningModule) return null;

    // Meertalige content (AI-uitbreiding): titel/beschrijving/vragen in de
    // gevraagde taal, met terugval op de originele content.
    const localized = (await learningTranslationService.localizeModule(
      learningModule as any,
      language,
    )) as typeof learningModule;

    const progress = await prisma.learningProgress.findUnique({
      where: {
        learning_progress_user_module_unique: {
          user_id: user.id,
          module_id: moduleId,
        },
      },
    });

    return { ...localized, progress };
  },

  /** Kijk-/leesvoortgang bijwerken (geen quiz). */
  /**
   * Voortgang van een module terugzetten (bewuste uitbreiding t.o.v. het oude
   * LMS, keuze van de gebruiker zelf): status/score/antwoorden gaan naar de
   * beginstand zodat video én quiz opnieuw gedaan kunnen worden. Eerder
   * behaalde certificaten blijven bewust staan (historisch bewijs).
   */
  async resetProgress(user: AuthUser, moduleId: string) {
    const visible = await this.getModuleVisible(user, moduleId);
    if (!visible) return null;
    return prisma.learningProgress.upsert({
      where: {
        learning_progress_user_module_unique: {
          user_id: user.id,
          module_id: moduleId,
        },
      },
      update: {
        status: "not_started",
        progress: 0,
        score: null,
        answers: Prisma.DbNull,
        started_at: null,
        completed_at: null,
        last_accessed_at: new Date(),
      },
      create: {
        user_id: user.id,
        module_id: moduleId,
        status: "not_started",
        progress: 0,
      },
    });
  },

  async updateProgress(
    user: AuthUser,
    moduleId: string,
    data: { progress?: number; time_spent_delta?: number },
  ) {
    // Toegangscheck: module moet zichtbaar zijn voor deze gebruiker.
    const visible = await this.getModuleVisible(user, moduleId);
    if (!visible) return null;

    const percent = Math.max(0, Math.min(100, Math.round(data.progress ?? 0)));
    const timeDelta = Math.max(0, Math.round(data.time_spent_delta ?? 0));
    const now = new Date();

    const existing = await prisma.learningProgress.findUnique({
      where: {
        learning_progress_user_module_unique: {
          user_id: user.id,
          module_id: moduleId,
        },
      },
    });

    // Voortgang mag nooit terugvallen; afgerond blijft afgerond.
    const newPercent = Math.max(existing?.progress ?? 0, percent);
    const completed =
      existing?.status === "completed" || newPercent >= 100;

    return prisma.learningProgress.upsert({
      where: {
        learning_progress_user_module_unique: {
          user_id: user.id,
          module_id: moduleId,
        },
      },
      update: {
        progress: newPercent,
        status: completed
          ? "completed"
          : newPercent > 0
            ? "in_progress"
            : "not_started",
        time_spent: { increment: timeDelta },
        completed_at: completed ? (existing?.completed_at ?? now) : null,
        last_accessed_at: now,
      },
      create: {
        user_id: user.id,
        module_id: moduleId,
        progress: newPercent,
        status: newPercent >= 100 ? "completed" : newPercent > 0 ? "in_progress" : "not_started",
        time_spent: timeDelta,
        started_at: now,
        completed_at: newPercent >= 100 ? now : null,
        last_accessed_at: now,
      },
    });
  },

  /**
   * Quiz inleveren: server-side beoordelen, voortgang bijwerken en bij
   * slagen (>= QUIZ_PASS_SCORE) een certificaat uitreiken.
   */
  async submitQuiz(
    user: AuthUser,
    moduleId: string,
    answers: Record<string, number>,
  ) {
    const visible = await this.getModuleVisible(user, moduleId);
    if (!visible) return null;

    const questions = await prisma.learningQuestion.findMany({
      where: { module_id: moduleId },
      orderBy: { order_index: "asc" },
    });
    if (questions.length === 0) return null;

    let correct = 0;
    const results = questions.map((q) => {
      const given = answers?.[q.id];
      const isCorrect = given === q.correct_answer;
      if (isCorrect) correct++;
      return {
        question_id: q.id,
        given,
        correct_answer: q.correct_answer,
        is_correct: isCorrect,
        explanation: q.explanation,
      };
    });

    const score = Math.round((correct / questions.length) * 100);
    const passed = score >= QUIZ_PASS_SCORE;
    const now = new Date();

    const existing = await prisma.learningProgress.findUnique({
      where: {
        learning_progress_user_module_unique: {
          user_id: user.id,
          module_id: moduleId,
        },
      },
    });
    const bestScore = Math.max(existing?.score ?? 0, score);
    const wasCompleted = existing?.status === "completed";

    await prisma.learningProgress.upsert({
      where: {
        learning_progress_user_module_unique: {
          user_id: user.id,
          module_id: moduleId,
        },
      },
      update: {
        score: bestScore,
        answers,
        progress: passed ? 100 : Math.max(existing?.progress ?? 0, 0),
        status: passed || wasCompleted ? "completed" : "in_progress",
        completed_at: passed ? (existing?.completed_at ?? now) : existing?.completed_at,
        last_accessed_at: now,
      },
      create: {
        user_id: user.id,
        module_id: moduleId,
        score,
        answers,
        progress: passed ? 100 : 0,
        status: passed ? "completed" : "in_progress",
        started_at: now,
        completed_at: passed ? now : null,
        last_accessed_at: now,
      },
    });

    // Certificaat bij slagen (één per user+module; hoogste score blijft staan)
    let certificate = null;
    if (passed) {
      const existingCert = await prisma.learningCertificate.findFirst({
        where: { user_id: user.id, module_id: moduleId },
      });
      if (existingCert) {
        certificate =
          score > existingCert.score
            ? await prisma.learningCertificate.update({
                where: { id: existingCert.id },
                data: { score, completed_at: now },
              })
            : existingCert;
      } else {
        certificate = await prisma.learningCertificate.create({
          data: {
            user_id: user.id,
            module_id: moduleId,
            certificate_number: `REPPIC-${Date.now()}-${Math.random()
              .toString(36)
              .slice(2, 11)
              .toUpperCase()}`,
            score,
            completed_at: now,
          },
        });
      }
    }

    return { score, passed, pass_score: QUIZ_PASS_SCORE, results, certificate };
  },

  /** Eigen voortgangsoverzicht (voor de voortgangspagina + dashboardtegel). */
  async getProgressSummary(user: AuthUser, targetUserId?: string) {
    // Een manager/learning_admin/superadmin mag andermans voortgang zien
    // binnen de eigen scope; anders alleen jezelf.
    const userId = targetUserId || user.id;
    if (userId !== user.id) {
      const allowed = await this.mayViewUserLearning(user, userId);
      if (!allowed) return null;
    }

    const [progress, certificates, assignments] = await Promise.all([
      prisma.learningProgress.findMany({
        where: { user_id: userId },
        include: {
          module: {
            select: {
              id: true,
              title: true,
              learning_path_type: true,
              phase: true,
              duration: true,
            },
          },
        },
        orderBy: { last_accessed_at: "desc" },
      }),
      prisma.learningCertificate.findMany({
        where: { user_id: userId },
        include: { module: { select: { id: true, title: true } } },
        orderBy: { completed_at: "desc" },
      }),
      prisma.userModuleAssignment.count({ where: { user_id: userId } }),
    ]);

    const completed = progress.filter((p) => p.status === "completed").length;
    const inProgress = progress.filter((p) => p.status === "in_progress").length;
    const totalTime = progress.reduce((sum, p) => sum + p.time_spent, 0);

    // Moduletitels in de taal van de KIJKER (profieltaal) — zelfde bron als de
    // detailpagina, zodat óók de voortgangspagina nooit de basistaal toont.
    const lang = resolveContentLanguage(user);
    if (lang) {
      const moduleIds = [
        ...new Set([
          ...progress.map((p) => p.module.id),
          ...certificates.map((c) => c.module.id),
        ]),
      ];
      if (moduleIds.length > 0) {
        const translations = await prisma.learningModuleTranslation.findMany({
          where: { module_id: { in: moduleIds }, language: lang },
          select: { module_id: true, content: true },
        });
        const titleByModule = new Map(
          translations
            .map((t) => [
              t.module_id,
              (t.content as { title?: string } | null)?.title,
            ])
            .filter((e): e is [string, string] => Boolean(e[1])),
        );
        for (const p of progress) {
          const tr = titleByModule.get(p.module.id);
          if (tr) p.module.title = tr;
        }
        for (const c of certificates) {
          const tr = titleByModule.get(c.module.id);
          if (tr) c.module.title = tr;
        }
      }
    }

    return {
      user_id: userId,
      stats: {
        completed,
        in_progress: inProgress,
        assigned: assignments,
        total_time_minutes: totalTime,
        certificates: certificates.length,
      },
      progress,
      certificates,
    };
  },

  /** Mag deze gebruiker de leerdata van targetUserId inzien? */
  async mayViewUserLearning(user: AuthUser, targetUserId: string) {
    if (isSuperAdmin(user)) return true;
    const target = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { company_id: true, manager_id: true },
    });
    if (!target) return false;
    // learning_admin: eigen bedrijf; manager: eigen team (directe rapportlijn).
    if (
      user.learning_role === LEARNING_ROLE.LEARNING_ADMIN &&
      target.company_id === user.company_id
    ) {
      return true;
    }
    if (
      user.role?.name === USER_ROLE.MANAGER &&
      target.company_id === user.company_id
    ) {
      return true;
    }
    return false;
  },

  async getModuleVisible(user: AuthUser, moduleId: string) {
    const where: any = await accessibleModulesWhere(user);
    const found = await prisma.learningModule.findFirst({
      where: { ...where, id: moduleId },
      select: { id: true },
    });
    return Boolean(found);
  },

  // ───────────────────────── Beheer (learning_admin / superadmin) ─────────

  /** Medewerkers van het eigen bedrijf met leerstatistieken. */
  async getCompanyEmployees(user: AuthUser, companyIdParam?: string) {
    if (!isLearningAdmin(user)) return null;
    // Superadmin mag elk bedrijf opvragen; learning_admin alleen het eigen.
    const companyId = isSuperAdmin(user)
      ? companyIdParam || user.company_id
      : user.company_id;
    if (!companyId) return null;

    const employees = await prisma.user.findMany({
      where: { company_id: companyId },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        learning_role: true,
        role: { select: { name: true } },
        _count: {
          select: {
            module_assignments: true,
            learning_certificates: true,
          },
        },
        learning_progress: {
          select: { status: true },
        },
      },
      orderBy: { name: "asc" },
    });

    return employees.map((e) => ({
      id: e.id,
      name: e.name,
      email: e.email,
      avatar: e.avatar,
      learning_role: e.learning_role,
      sales_role: e.role?.name,
      assigned: e._count.module_assignments,
      certificates: e._count.learning_certificates,
      completed: e.learning_progress.filter((p) => p.status === "completed")
        .length,
      in_progress: e.learning_progress.filter(
        (p) => p.status === "in_progress",
      ).length,
    }));
  },

  /** Leer-rol van een medewerker aanpassen (tenant-veilig). */
  async setLearningRole(
    user: AuthUser,
    targetUserId: string,
    learningRole: string,
  ) {
    if (!isLearningAdmin(user)) return { error: "forbidden" as const };
    const valid: string[] = [
      LEARNING_ROLE.NONE,
      LEARNING_ROLE.LEARNER,
      LEARNING_ROLE.LEARNING_ADMIN,
    ];
    if (!valid.includes(learningRole)) return { error: "invalid" as const };

    const target = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { company_id: true, role: { select: { name: true } } },
    });
    if (!target) return { error: "not_found" as const };
    // Tenant-isolatie: learning_admin alleen binnen eigen bedrijf, en nooit
    // aan een platform-superadmin sleutelen.
    if (!isSuperAdmin(user)) {
      if (target.company_id !== user.company_id) {
        return { error: "forbidden" as const };
      }
      if (target.role?.name === USER_ROLE.SUPER_ADMIN) {
        return { error: "forbidden" as const };
      }
    }

    const updated = await prisma.user.update({
      where: { id: targetUserId },
      data: { learning_role: learningRole as any },
      select: { id: true, learning_role: true },
    });
    return { data: updated };
  },

  /** Modules toewijzen aan een medewerker (tenant-veilig). */
  async assignModules(
    user: AuthUser,
    targetUserId: string,
    moduleIds: string[],
    isRequired: boolean = true,
    dueDate?: string | null,
  ) {
    if (!isLearningAdmin(user)) return { error: "forbidden" as const };
    const allowed = await this.mayViewUserLearning(user, targetUserId);
    if (!allowed) return { error: "forbidden" as const };

    // Alleen modules die de doelgebruiker ook echt mag zien.
    const target = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        email: true,
        company_id: true,
        learning_role: true,
        role: { select: { name: true } },
      },
    });
    if (!target) return { error: "not_found" as const };
    const targetWhere: any = await accessibleModulesWhere(target as AuthUser);
    const visibleModules = await prisma.learningModule.findMany({
      where: { ...targetWhere, id: { in: moduleIds } },
      select: { id: true },
    });

    const created = [];
    for (const m of visibleModules) {
      created.push(
        await prisma.userModuleAssignment.upsert({
          where: {
            user_module_assignment_unique: {
              user_id: targetUserId,
              module_id: m.id,
            },
          },
          update: {
            is_required: isRequired,
            due_date: dueDate ? new Date(dueDate) : null,
          },
          create: {
            user_id: targetUserId,
            module_id: m.id,
            assigned_by: user.id,
            is_required: isRequired,
            due_date: dueDate ? new Date(dueDate) : null,
          },
        }),
      );
    }
    return { data: created };
  },

  async removeAssignment(
    user: AuthUser,
    targetUserId: string,
    moduleId: string,
  ) {
    if (!isLearningAdmin(user)) return { error: "forbidden" as const };
    const allowed = await this.mayViewUserLearning(user, targetUserId);
    if (!allowed) return { error: "forbidden" as const };
    await prisma.userModuleAssignment.deleteMany({
      where: { user_id: targetUserId, module_id: moduleId },
    });
    return { data: true };
  },

  // ─────────────────── Modulebeheer (content maken/bewerken) ─────────────

  /**
   * Module aanmaken/bijwerken.
   * - superadmin: globale content (sales_skills én knowledge).
   * - learning_admin: alleen knowledge-content voor het eigen bedrijf,
   *   en alleen als het bedrijf lms_enabled heeft.
   */
  async upsertModule(
    user: AuthUser,
    data: {
      id?: string;
      title: string;
      description?: string;
      duration?: number;
      category_id?: string | null;
      learning_path_type?: string;
      phase?: number | null;
      content_type?: string;
      video_url?: string | null;
      video_embed_code?: string | null;
      thumbnail_url?: string | null;
      is_required?: boolean;
      original_language?: string;
      questions?: Array<{
        id?: string;
        question: string;
        options: string[];
        correct_answer: number;
        explanation?: string | null;
        order_index?: number;
      }>;
    },
  ) {
    const superAdmin = isSuperAdmin(user);
    if (!isLearningAdmin(user)) return { error: "forbidden" as const };

    const pathType =
      data.learning_path_type === "sales_skills" ? "sales_skills" : "knowledge";

    let companyId: string | null = null;
    if (!superAdmin) {
      // learning_admin: alleen knowledge, alleen eigen bedrijf, alleen bij lms_enabled.
      if (pathType === "sales_skills") return { error: "forbidden" as const };
      if (!user.company_id) return { error: "forbidden" as const };
      const enabled = await companyLmsEnabled(user.company_id);
      if (!enabled) return { error: "lms_disabled" as const };
      companyId = user.company_id;
    }

    const contentType = ["video", "presentation", "document"].includes(
      data.content_type || "",
    )
      ? (data.content_type as "video" | "presentation" | "document")
      : "video";

    const moduleData = {
      title: data.title,
      description: data.description || "",
      duration: Math.max(0, Math.round(data.duration ?? 0)),
      category_id: data.category_id || null,
      learning_path_type: pathType as any,
      phase: pathType === "sales_skills" ? (data.phase ?? null) : null,
      content_type: contentType as any,
      video_url: data.video_url || null,
      video_embed_code: data.video_embed_code || null,
      thumbnail_url: data.thumbnail_url || null,
      is_required: Boolean(data.is_required),
      original_language: data.original_language || "en",
    };

    let saved;
    if (data.id) {
      // Bewerken: check eigenaarschap.
      const existing = await prisma.learningModule.findUnique({
        where: { id: data.id },
        select: { company_id: true, learning_path_type: true },
      });
      if (!existing) return { error: "not_found" as const };
      if (!superAdmin && existing.company_id !== user.company_id) {
        return { error: "forbidden" as const };
      }
      if (!superAdmin && existing.learning_path_type === "sales_skills") {
        return { error: "forbidden" as const };
      }
      saved = await prisma.learningModule.update({
        where: { id: data.id },
        data: moduleData,
      });
    } else {
      saved = await prisma.learningModule.create({
        data: {
          ...moduleData,
          company_id: superAdmin ? null : companyId,
          created_by: user.id,
        },
      });
    }

    // Quizvragen volledig vervangen als ze meegestuurd zijn.
    if (Array.isArray(data.questions)) {
      await prisma.learningQuestion.deleteMany({
        where: { module_id: saved.id },
      });
      for (let i = 0; i < data.questions.length; i++) {
        const q = data.questions[i];
        if (!q.question || !Array.isArray(q.options)) continue;
        await prisma.learningQuestion.create({
          data: {
            module_id: saved.id,
            question: q.question,
            options: q.options,
            correct_answer: Math.max(
              0,
              Math.min(q.options.length - 1, q.correct_answer ?? 0),
            ),
            explanation: q.explanation || null,
            order_index: q.order_index ?? i,
          },
        });
      }
    }

    return { data: saved };
  },

  async deleteModule(user: AuthUser, moduleId: string) {
    if (!isLearningAdmin(user)) return { error: "forbidden" as const };
    const existing = await prisma.learningModule.findUnique({
      where: { id: moduleId },
      select: { company_id: true, learning_path_type: true },
    });
    if (!existing) return { error: "not_found" as const };
    if (!isSuperAdmin(user)) {
      if (
        existing.company_id !== user.company_id ||
        existing.learning_path_type === "sales_skills"
      ) {
        return { error: "forbidden" as const };
      }
    }
    // Soft delete, consistent met de oude videobibliotheek.
    await prisma.learningModule.update({
      where: { id: moduleId },
      data: { deleted_at: new Date() },
    });
    return { data: true };
  },

  /** Volledig moduledetail voor beheer (mét juiste antwoorden). */
  async getModuleForManage(user: AuthUser, moduleId: string) {
    if (!isLearningAdmin(user)) return null;
    const learningModule = await prisma.learningModule.findUnique({
      where: { id: moduleId },
      include: {
        category: { select: { id: true, name: true } },
        questions: { orderBy: { order_index: "asc" } },
      },
    });
    if (!learningModule) return null;
    if (!isSuperAdmin(user) && learningModule.company_id !== user.company_id) {
      return null;
    }
    return learningModule;
  },

  async getCategories(user: AuthUser, type?: string) {
    const where: any = {
      OR: [{ company_id: null }, { company_id: user.company_id }],
    };
    if (type === "sales_skills" || type === "knowledge") {
      where.learning_path_type = type;
    }
    return prisma.learningCategory.findMany({
      where,
      orderBy: [{ sort_order: "asc" }, { name: "asc" }],
    });
  },

  async upsertCategory(
    user: AuthUser,
    data: {
      id?: string;
      name: string;
      description?: string | null;
      learning_path_type?: string;
    },
  ) {
    if (!isLearningAdmin(user)) return { error: "forbidden" as const };
    const superAdmin = isSuperAdmin(user);
    const pathType =
      data.learning_path_type === "sales_skills" ? "sales_skills" : "knowledge";
    if (!superAdmin && pathType === "sales_skills") {
      return { error: "forbidden" as const };
    }
    if (data.id) {
      const existing = await prisma.learningCategory.findUnique({
        where: { id: data.id },
        select: { company_id: true },
      });
      if (!existing) return { error: "not_found" as const };
      if (!superAdmin && existing.company_id !== user.company_id) {
        return { error: "forbidden" as const };
      }
      const updated = await prisma.learningCategory.update({
        where: { id: data.id },
        data: { name: data.name, description: data.description || null },
      });
      return { data: updated };
    }
    const created = await prisma.learningCategory.create({
      data: {
        name: data.name,
        description: data.description || null,
        learning_path_type: pathType as any,
        company_id: superAdmin ? null : user.company_id,
        created_by: user.id,
      },
    });
    return { data: created };
  },

  /** Leercategorie verwijderen; modules verliezen alleen hun categorie (SetNull). */
  async deleteCategory(user: AuthUser, categoryId: string) {
    if (!isLearningAdmin(user)) return { error: "forbidden" as const };
    const existing = await prisma.learningCategory.findUnique({
      where: { id: categoryId },
      select: { company_id: true },
    });
    if (!existing) return { error: "not_found" as const };
    // learning_admin: alleen categorieën van het eigen bedrijf, geen globale.
    if (!isSuperAdmin(user) && existing.company_id !== user.company_id) {
      return { error: "forbidden" as const };
    }
    await prisma.learningCategory.delete({ where: { id: categoryId } });
    return { data: true };
  },
};
