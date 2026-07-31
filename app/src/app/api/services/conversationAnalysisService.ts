import { analyze } from "@/lib/transcript-analysis";
import type {
  AnalysisPersistOutput,
  AnalysisOutput,
  Resistance,
} from "@/lib/transcript-analysis/types";
import {
  AUDIO_RETENTION_MS,
  CONVERSATION_STATUS,
  TWIN_AI_STATUS,
} from "@/configs/constants";
import { ConversationService } from "./conversationService";
import { ConversationSummaryService } from "./conversationSummaryService";
import { mailService } from "./mailService";
import { UserService } from "./userService";
import { completeChat } from "./litellmClient";
import { platformSettingsService } from "./platformSettingsService";
import { DashboardSyncService } from "./dashboardSyncService";
import { buildPicaPerformanceFromPhaseRows } from "./phasePerformanceService";
import { analyzeOperational } from "./operationalAnalysisService";
import {
  getCompanyTerminology,
  buildGlossaryPromptBlock,
} from "./terminologyService";

export type UiResistance = {
  Objection: string;
  Response: string;
  Conclusion: string;
  Reasoning: string;
};

function safeParseJson<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "object") return value as T;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function mapResistanceToUi(w: Resistance): UiResistance {
  return {
    Objection: w.KlantWeerstand,
    Response: w.VerkoperReactie,
    Conclusion: w.Conclusie,
    Reasoning: w.Reden,
  };
}

function extractResistances(output: AnalysisPersistOutput): UiResistance[] {
  const weerstanden = output.Weerstanden;

  if (Array.isArray(weerstanden)) {
    return weerstanden.map((w) => {
      if ("KlantWeerstand" in w) {
        return mapResistanceToUi(w as Resistance);
      }
      return w as UiResistance;
    });
  }

  if (weerstanden && typeof weerstanden === "object" && "text" in weerstanden) {
    return safeParseJson<UiResistance[]>(weerstanden.text, []);
  }

  return [];
}

export type PersistAnalysisParams = {
  conversationId: string;
  transcribedText: string;
  output: AnalysisPersistOutput;
  userId?: string;
};

export async function persistFromAnalysisOutput({
  conversationId,
  transcribedText,
  output,
  userId: userIdParam,
}: PersistAnalysisParams): Promise<{ userId: string } | null> {
  const existing =
    await ConversationSummaryService.findByConversationId(conversationId);

  if (existing.length > 0) {
    console.log(
      `[ConversationAnalysis] Summary already exists for ${conversationId}, skipping persist`,
    );

    const summary = existing[0];
    const conv = summary as { user_conversation?: { user_id?: string } };
    const uid = userIdParam || conv.user_conversation?.user_id;

    return uid ? { userId: uid } : null;
  }

  const resistances = extractResistances(output);
  const resistanceText = JSON.stringify(resistances);

  const {
    Leerpunten: learningPoints,
    Mail: mailText,
    Samenvatting: summaryText,
    PercentageVerkoper,
    Sfeer,
    Totaalscore,
    Fases,
    Klanttype,
    GeenSalesgesprek,
  } = output;

  // A non-sales conversation must not count toward any assessment.
  const isNonSalesConversation = GeenSalesgesprek === true;

  await ConversationSummaryService.create({
    conversation_id: conversationId,
    transcribed_text: transcribedText,
    learning_points: learningPoints,
    mail_text: mailText,
    summary_text: summaryText,
    resistance_text: resistanceText,
    salesperson_percentage: PercentageVerkoper,
    atmosphere: Sfeer,
    total_score: Totaalscore,
    phases: safeParseJson(Fases, Array.isArray(Fases) ? Fases : []),
    resistances,
    customer_type: Klanttype,
    geen_salesgesprek: isNonSalesConversation,
  });

  let userId = userIdParam;

  if (!userId) {
    const conversationSummary =
      await ConversationService.getConversationSummaryXById(conversationId);
    userId = conversationSummary?.user_conversation?.user_id;
  }

  if (!userId) {
    throw new Error("User not found for conversation");
  }

  await ConversationService.updateConversationX(
    {
      conversation_status: CONVERSATION_STATUS.COMPLETED_TWIN_AI_PROCESS,
      transcript_status: "completed",
      twinai_run_status: TWIN_AI_STATUS.COMPLETED,
      audio_retention_until: new Date(Date.now() + AUDIO_RETENTION_MS),
    },
    conversationId,
    userId,
  );

  const conversation = await ConversationService.getConversationById(
    conversationId,
    userId,
  );
  const { customer, title: conversationTitle } = conversation || {};
  const { name: customerName } = customer || {};
  const conversationCreatedAt = conversation?.created_at;
  const fileDuration = conversation?.file_duration;

  const user = await UserService.getUserProfile(userId);
  const { name: userName, lang_code: lang, email: userEmail } = user;

  // Only feed real sales conversations into the operational/strategic
  // dashboards. A non-sales conversation must not affect those aggregates.
  if (!isNonSalesConversation) {
    // Single source of truth for the whole operational dashboard: run the
    // operational analysis (dealHealth / resistances / next-step discipline /
    // DMU / USP) HERE in the app, then OVERRIDE its PICA with the main
    // analysis' PICA (the exact same numbers the salesperson's personal
    // dashboard shows). The backend consumes this instead of re-analysing, so
    // every operational tile + conclusion stays coherent with the PICA score.
    const picaPerformance = buildPicaPerformanceFromPhaseRows([Fases]);
    let operational: Record<string, unknown> = {};
    try {
      operational = (await analyzeOperational(
        transcribedText,
        lang || "nl",
      )) as unknown as Record<string, unknown>;
    } catch (opErr) {
      console.error(
        `[ConversationAnalysis] Operational analysis failed for ${conversationId} — backend will fall back to its own analysis:`,
        opErr,
      );
    }
    const coachingAnalysis = { ...operational, picaPerformance };

    await DashboardSyncService.pushTranscript({
      userId,
      email: userEmail,
      role: (user as { role?: { name?: string } }).role?.name,
      companyId: (user as { company_id?: string | null }).company_id ?? null,
      language: lang || "nl",
      filename:
        conversationTitle ||
        (customerName ? `Gesprek met ${customerName}` : `Gesprek ${conversationId}`),
      content: transcribedText,
      coachingAnalysis,
    });
  } else {
    console.log(
      `[ConversationAnalysis] ${conversationId} is not a sales conversation — skipping dashboard sync.`,
    );
  }

  const appUrl = process.env.APP_URL || "https://app.reppic.ai";
  const appName = process.env.APP_NAME || "Reppic";
  const emailFrom = process.env.EMAIL_FROM || "noreply@reppic.ai";
  const conversationLink = `${appUrl}/conversations/${conversationId}`;

  // Emails are best-effort: a mail failure must never mark an already
  // persisted analysis as failed, and one failing mail must not block the others.
  const emailResults = await Promise.allSettled([
    mailService.sendEvaluationEmailToUser({
      lang: lang || "en",
      conversationLink,
      appName,
      customerName: customerName || "",
      userName,
      emailFrom,
      userEmail,
      appUrl,
    }),
    mailService.sendFollowUpEmailForCustomerToUser({
      lang: lang || "en",
      appName,
      emailFrom,
      userEmail,
      appUrl,
      subject:
        "Follow up email for conversation with title: " + conversationTitle,
      emailBody: mailText || "",
    }),
    mailService.sendConversationReportEmailToUser({
      lang: lang || "en",
      appUrl,
      userName,
      customerName: customerName || conversationTitle || "",
      conversationId,
      conversationCreatedAt: conversationCreatedAt?.toString(),
      totalScore: Totaalscore ?? 0,
      atmosphereRaw: Sfeer || "",
      salespersonPercentage: PercentageVerkoper ?? null,
      fileDurationSeconds: fileDuration ?? undefined,
      summaryText: summaryText || "",
      learningPoints: Array.isArray(learningPoints) ? learningPoints : [],
      appName,
      emailFrom,
      userEmail,
    }),
  ]);

  for (const result of emailResults) {
    if (result.status === "rejected") {
      console.error(
        `[ConversationAnalysis] Email failed for ${conversationId}:`,
        result.reason,
      );
    }
  }

  return { userId };
}

async function markAnalysisFailed(
  conversationId: string,
  userId: string,
  error: unknown,
) {
  try {
    await ConversationService.updateConversationX(
      {
        conversation_status: CONVERSATION_STATUS.TWIN_AI_UPLOAD_FAILED,
        twinai_run_status: TWIN_AI_STATUS.FAILED,
      },
      conversationId,
      userId,
    );
  } catch (updateErr) {
    console.error(
      "[ConversationAnalysis] Failed to update failure status:",
      updateErr,
    );
  }

  const err = error instanceof Error ? error : new Error(String(error));

  await mailService.sendTwinAIErrorNotification({
    error: err,
    operation: "LiteLLM: conversation analysis",
    conversationId,
    userId,
    attempts: 1,
    errorStack: err.stack,
  });
}

export const ConversationAnalysisService = {
  async analyzeAndPersist(
    conversationId: string,
    userId: string,
    transcriptText: string,
    langCode?: string,
  ): Promise<AnalysisOutput> {
    const language = langCode || "en";

    try {
      await ConversationService.updateConversationX(
        {
          twinai_run_status: TWIN_AI_STATUS.IN_PROCESS,
        },
        conversationId,
        userId,
      );

      const { model, tag, usesAdaptiveThinking } =
        await platformSettingsService.getAnalysisLiteLLMRoute();

      // Per-company terminology glossary (optional): make the written feedback
      // use the company's own training jargon. No glossary → prompt unchanged.
      const analysisUser = await UserService.getUserProfile(userId);
      const terminologyMapping = await getCompanyTerminology(
        (analysisUser as { company_id?: string | null })?.company_id ?? null,
      );
      const terminologyBlock = buildGlossaryPromptBlock(terminologyMapping);

      const output = await analyze(
        transcriptText,
        language,
        (prompt) =>
          completeChat(
            prompt,
            { conversationId, userId },
            { model, tag, usesAdaptiveThinking },
          ),
        { terminologyBlock },
      );

      await persistFromAnalysisOutput({
        conversationId,
        userId,
        transcribedText: transcriptText,
        output,
      });

      return output;
    } catch (error) {
      await markAnalysisFailed(conversationId, userId, error);

      throw error;
    }
  },
};
