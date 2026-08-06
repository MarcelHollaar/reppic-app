/**
 * Meertalige module-content (AI-uitbreiding, afronding F2).
 *
 * Port van het oude LMS translations-mechanisme: een module heeft een
 * `original_language`; voor andere talen wordt de content (titel, beschrijving,
 * quizvragen) vertaald en opgeslagen in learning_module_translations. Vertalen
 * gebeurt via de bestaande LiteLLM-gateway; juiste antwoorden blijven puur
 * indices (worden niet meegestuurd/vertaald).
 */
import { prisma } from "@/app/api/utils/prisma";
import { completeChat } from "@/app/api/services/litellmClient";
import { getLmsChatRoute } from "@/app/api/services/learningModelSettingsService";
import { PLATFORM_SETTING_KEYS } from "@/configs/constants";
import {
  AuthUser,
  isSuperAdmin,
  isLearningAdmin,
} from "@/lib/services/learningService";

export const SUPPORTED_LANGUAGES = ["en", "nl", "de", "fr", "es", "it"];

const LANG_NAME: Record<string, string> = {
  en: "English",
  nl: "Dutch",
  de: "German",
  fr: "French",
  es: "Spanish",
  it: "Italian",
};

type TranslatedContent = {
  title: string;
  description: string;
  questions: { question: string; options: string[]; explanation: string | null }[];
  // Per-taal media (1-op-1 met productie: translations type module_video /
  // module_thumbnail): een Duitse gebruiker krijgt de Dúítse Synthesia-video.
  videoCode?: string;
  thumbnailUrl?: string;
};

type Result<T> = { data: T } | { error: "forbidden" | "not_found" | "invalid" };

function stripFences(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
}

async function canManageModule(user: AuthUser, moduleId: string) {
  const m = await prisma.learningModule.findUnique({
    where: { id: moduleId },
    select: { company_id: true, learning_path_type: true },
  });
  if (!m) return { error: "not_found" as const };
  if (!isSuperAdmin(user)) {
    if (m.company_id !== user.company_id || m.learning_path_type === "sales_skills") {
      return { error: "forbidden" as const };
    }
  }
  return { module: m };
}

export const learningTranslationService = {
  /** Welke talen zijn al vertaald voor deze module? */
  async getTranslationStatus(user: AuthUser, moduleId: string) {
    if (!isLearningAdmin(user)) return null;
    const rows = await prisma.learningModuleTranslation.findMany({
      where: { module_id: moduleId },
      select: { language: true, updated_at: true },
    });
    return rows;
  },

  /**
   * Genereer (of ververs) vertalingen voor de opgegeven talen via de LLM.
   * De brontaal (original_language) wordt overgeslagen.
   */
  async generateTranslations(
    user: AuthUser,
    moduleId: string,
    languages: string[],
  ): Promise<Result<{ languages: string[] }>> {
    if (!isLearningAdmin(user)) return { error: "forbidden" };
    const check = await canManageModule(user, moduleId);
    if ("error" in check) return { error: check.error! };

    const learningModule = await prisma.learningModule.findUnique({
      where: { id: moduleId },
      include: { questions: { orderBy: { order_index: "asc" } } },
    });
    if (!learningModule) return { error: "not_found" };

    const sourceLang = learningModule.original_language || "en";
    const targets = languages.filter(
      (l) => SUPPORTED_LANGUAGES.includes(l) && l !== sourceLang,
    );
    if (targets.length === 0) return { error: "invalid" };

    const source = {
      title: learningModule.title,
      description: learningModule.description || "",
      questions: learningModule.questions.map((q) => ({
        question: q.question,
        options: (q.options as string[]) || [],
        explanation: q.explanation || "",
      })),
    };

    // Superadmin-gekozen model voor vertalingen (leeg = env-default).
    const chatRoute = await getLmsChatRoute(
      PLATFORM_SETTING_KEYS.LMS_TRANSLATION_LITELLM_MODEL,
    );

    const done: string[] = [];
    for (const lang of targets) {
      const prompt = `Translate the learning-module content below from ${LANG_NAME[sourceLang] || sourceLang} to ${LANG_NAME[lang] || lang}.
Keep the meaning, tone and any product/technical terms. Preserve the exact array order and length of "questions" and each "options" array (do NOT add, remove or reorder options — the correct-answer index must stay valid).

Return ONLY a JSON object with this exact shape:
{
  "title": "…",
  "description": "…",
  "questions": [ { "question": "…", "options": ["…", …], "explanation": "…" }, … ]
}

Source content:
${JSON.stringify(source)}`;

      try {
        const raw = await completeChat(prompt, { userId: user.id }, chatRoute);
        const parsed = JSON.parse(stripFences(raw)) as TranslatedContent;
        // Optie-aantallen mogen niet verschuiven (correct_answer-index moet geldig blijven).
        const safeQuestions = source.questions.map((sq, i) => {
          const tq = parsed.questions?.[i];
          const options =
            Array.isArray(tq?.options) && tq!.options.length === sq.options.length
              ? tq!.options
              : sq.options;
          return {
            question: tq?.question || sq.question,
            options,
            explanation: tq?.explanation ?? sq.explanation,
          };
        });
        await prisma.learningModuleTranslation.upsert({
          where: {
            learning_module_translation_unique: {
              module_id: moduleId,
              language: lang,
            },
          },
          update: {
            content: {
              title: parsed.title || source.title,
              description: parsed.description || source.description,
              questions: safeQuestions,
            },
          },
          create: {
            module_id: moduleId,
            language: lang,
            content: {
              title: parsed.title || source.title,
              description: parsed.description || source.description,
              questions: safeQuestions,
            },
          },
        });
        done.push(lang);
      } catch (err) {
        console.error(
          `[learning] vertaling naar ${lang} mislukt voor module ${moduleId}:`,
          err,
        );
      }
    }

    if (done.length === 0) return { error: "invalid" };
    return { data: { languages: done } };
  },

  async deleteTranslation(
    user: AuthUser,
    moduleId: string,
    language: string,
  ): Promise<Result<true>> {
    if (!isLearningAdmin(user)) return { error: "forbidden" };
    const check = await canManageModule(user, moduleId);
    if ("error" in check) return { error: check.error! };
    await prisma.learningModuleTranslation.deleteMany({
      where: { module_id: moduleId, language },
    });
    return { data: true };
  },

  /**
   * Haal de content van een module op in de gevraagde taal. Valt terug op de
   * originele content als er geen vertaling is. Gebruikt door de learner-API.
   */
  async localizeModule(
    learningModule: {
      id: string;
      title: string;
      description: string;
      original_language: string;
      questions?: { id: string; question: string; options: unknown; image_url: string | null; order_index: number }[];
    },
    language: string | undefined,
  ) {
    if (
      !language ||
      language === learningModule.original_language ||
      !SUPPORTED_LANGUAGES.includes(language)
    ) {
      return learningModule;
    }
    const translation = await prisma.learningModuleTranslation.findUnique({
      where: {
        learning_module_translation_unique: {
          module_id: learningModule.id,
          language,
        },
      },
      select: { content: true },
    });
    if (!translation) return learningModule;

    const content = translation.content as TranslatedContent;
    const localizedQuestions = learningModule.questions?.map((q, i) => {
      const tq = content.questions?.[i];
      return tq
        ? { ...q, question: tq.question, options: tq.options }
        : q;
    });
    return {
      ...learningModule,
      title: content.title || learningModule.title,
      description: content.description || learningModule.description,
      // Per-taal video/thumbnail (indien aanwezig in de vertaling) — anders
      // blijft de basistaal-versie staan.
      ...(content.videoCode ? { video_embed_code: content.videoCode } : {}),
      ...(content.thumbnailUrl ? { thumbnail_url: content.thumbnailUrl } : {}),
      ...(localizedQuestions ? { questions: localizedQuestions } : {}),
    };
  },
};
