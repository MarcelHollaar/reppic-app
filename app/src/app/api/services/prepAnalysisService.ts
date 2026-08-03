import { prisma } from "../utils/prisma";
import { completeChat } from "./litellmClient";
import { platformSettingsService } from "./platformSettingsService";
import { prepAnalysisPromptService } from "./prepAnalysisPromptService";
import { ProspectAccountService } from "./prospectAccountService";
import { HubspotService } from "./hubspotService";
import { mailService } from "./mailService";
import {
  parsePrepContent,
  type PrepContent,
} from "@/lib/prep-analysis/promptSchema";
import { extractExternalAttendees } from "@/lib/prospect/resolveProspect";

// Kern van de gespreksvoorbereiding: combineert de analyse van het vorige
// gesprek met dezelfde klant en de HubSpot-dealcontext tot een briefing, en
// mailt die naar de verkoper. Fallback-matrix (bouwplan):
//   - geen HubSpot        -> prep alleen uit het vorige gesprek
//   - geen vorig gesprek  -> prep alleen uit HubSpot
//   - geen van beide      -> skipped (no_sources), géén mail
// Elke meeting krijgt altijd een ConversationPrep-rij (dedupe + inzicht).

const MAX_FAIL_COUNT = 3;
// Verplaatste meeting: bij een verschuiving > 48u een al verstuurde prep
// opnieuw genereren (bouwplan risico 2).
const RESCHEDULE_RESET_MS = 48 * 60 * 60 * 1000;

export interface PrepMeetingInput {
  calendarEventId: string;
  title: string | null;
  startTime: Date;
  attendeeEmails: string[];
  organizerEmail: string;
}

export interface PrepResult {
  status: "generated" | "sent" | "skipped" | "failed" | "deduped";
  skipReason?: string;
  prepId?: string;
  content?: PrepContent;
}

// Shape van ConversationSummaryX.phases (zie enrichFases in
// src/lib/transcript-analysis/analyze.ts): {Score, Titel, Fase, Redenering, ...}
interface PhaseEntry {
  Score?: number;
  Titel?: string;
  Fase?: number | string;
  Redenering?: string;
  [key: string]: unknown;
}

/** Compact NL-tekstblok van de vorige-gesprek-analyse voor in de prompt. */
function buildPreviousConversationBlock(summary: {
  summary_text: string | null;
  phases: unknown;
  resistances: unknown;
  total_score: number | null;
  created_at: Date;
}): string {
  const lines: string[] = ["## Analyse van het vorige gesprek met deze klant"];
  lines.push(`- Datum: ${summary.created_at.toISOString().slice(0, 10)}`);
  if (summary.total_score != null) {
    lines.push(`- Totaalscore: ${summary.total_score}`);
  }
  if (summary.summary_text) {
    lines.push(`- Samenvatting: ${summary.summary_text}`);
  }

  const phases = Array.isArray(summary.phases)
    ? (summary.phases as PhaseEntry[])
    : [];
  // Score-schaal is 0/1/3: 0 = niet behandeld, 1 = onvoldoende.
  const missed = phases.filter(
    (p) => typeof p?.Score === "number" && p.Score <= 1
  );
  if (missed.length > 0) {
    lines.push("- Niet of onvoldoende behandelde gespreksfases:");
    for (const phase of missed) {
      const name = phase.Titel || `fase ${phase.Fase ?? "?"}`;
      lines.push(
        `  - ${name} (score ${phase.Score})${
          phase.Redenering ? `: ${phase.Redenering}` : ""
        }`
      );
    }
  }

  // Shape van resistances: {KlantWeerstand, VerkoperReactie, Conclusie, Reden}
  const resistances = Array.isArray(summary.resistances)
    ? (summary.resistances as Array<Record<string, unknown>>)
    : [];
  if (resistances.length > 0) {
    lines.push("- Waargenomen weerstanden:");
    for (const r of resistances) {
      const text =
        (r.KlantWeerstand as string) ||
        JSON.stringify(r).slice(0, 200);
      const conclusion = r.Conclusie ? ` (aanpak vorige keer: ${r.Conclusie})` : "";
      lines.push(`  - ${text}${conclusion}`);
    }
  }
  return lines.join("\n");
}

async function upsertPrepRow(params: {
  companyId: string;
  userId: string;
  meeting: PrepMeetingInput;
  prospectAccountId: string | null;
}) {
  return prisma.conversationPrep.upsert({
    where: { calendar_event_id: params.meeting.calendarEventId },
    update: { meeting_start: params.meeting.startTime },
    create: {
      company_id: params.companyId,
      user_id: params.userId,
      prospect_account_id: params.prospectAccountId,
      calendar_event_id: params.meeting.calendarEventId,
      meeting_title: params.meeting.title,
      meeting_start: params.meeting.startTime,
      source_conversation_ids: [],
      status: "pending",
    },
  });
}

export const prepAnalysisService = {
  /**
   * Genereert (en verstuurt) de voorbereiding voor één komende meeting.
   * Idempotent per calendar_event_id. `sendEmail: false` (preview/test)
   * genereert wel maar mailt niet.
   */
  async generatePrepForMeeting(params: {
    userId: string;
    meeting: PrepMeetingInput;
    sendEmail?: boolean;
  }): Promise<PrepResult> {
    const { userId, meeting } = params;
    const sendEmail = params.sendEmail ?? true;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        lang_code: true,
        company_id: true,
      },
    });
    if (!user?.company_id) {
      return { status: "skipped", skipReason: "no_company" };
    }
    const companyId = user.company_id;

    // --- Dedupe / hergenereer-beslissing ---
    const existing = await prisma.conversationPrep.findUnique({
      where: { calendar_event_id: meeting.calendarEventId },
    });
    if (existing) {
      const moved =
        Math.abs(
          existing.meeting_start.getTime() - meeting.startTime.getTime()
        ) > RESCHEDULE_RESET_MS;
      const exhausted =
        existing.status === "failed" && existing.fail_count >= MAX_FAIL_COUNT;
      const done =
        existing.status === "sent" ||
        existing.status === "generated" ||
        existing.status === "skipped";
      if ((done && !moved) || exhausted) {
        return { status: "deduped", prepId: existing.id };
      }
      if (done && moved) {
        // Meeting is fors verplaatst: opnieuw genereren.
        await prisma.conversationPrep.update({
          where: { id: existing.id },
          data: {
            status: "pending",
            skip_reason: null,
            meeting_start: meeting.startTime,
          },
        });
      }
    }

    // --- Externe deelnemers + prospect ---
    const externalAttendees = extractExternalAttendees(
      meeting.attendeeEmails,
      meeting.organizerEmail
    );
    if (externalAttendees.length === 0) {
      const row = await upsertPrepRow({
        companyId,
        userId,
        meeting,
        prospectAccountId: null,
      });
      await prisma.conversationPrep.update({
        where: { id: row.id },
        data: { status: "skipped", skip_reason: "no_external_attendees" },
      });
      return { status: "skipped", skipReason: "no_external_attendees" };
    }

    const resolved = await ProspectAccountService.resolveAndUpsertProspect(
      companyId,
      meeting.attendeeEmails,
      meeting.organizerEmail
    );
    const prospectAccountId = resolved?.prospectAccountId ?? null;
    const prepRow = await upsertPrepRow({
      companyId,
      userId,
      meeting,
      prospectAccountId,
    });

    try {
      // --- Bron 1: vorige gesprek van deze prospect ---
      let previousBlock: string | null = null;
      let previousConversationId: string | null = null;
      if (prospectAccountId) {
        const conversations =
          await ProspectAccountService.findConversationsForProspect(
            prospectAccountId
          );
        for (const conversation of conversations) {
          const summary = conversation.conversation_summaries_x?.[0];
          // geen_salesgesprek-analyses nooit als bron gebruiken (bouwplan).
          if (summary && !summary.geen_salesgesprek) {
            previousBlock = buildPreviousConversationBlock(summary);
            previousConversationId = conversation.id;
            break;
          }
        }
      }

      // --- Bron 2: HubSpot-context (eerste extern adres met een match) ---
      let crmBlock: string | null = null;
      let hubspotDealId: string | null = null;
      let prospectDisplayName: string | null = null;
      try {
        for (const email of externalAttendees.slice(0, 3)) {
          const context = await HubspotService.findCrmContextByEmail(
            companyId,
            email
          );
          if (context) {
            crmBlock = HubspotService.buildCrmContextBlock(context);
            hubspotDealId = context.deal?.id ?? null;
            prospectDisplayName =
              context.company?.name ||
              [context.contact?.firstName, context.contact?.lastName]
                .filter(Boolean)
                .join(" ") ||
              null;
            break;
          }
        }
      } catch (error) {
        // CRM-context is verrijking; nooit de prep laten falen op HubSpot.
        console.error("[Prep] HubSpot context failed (non-fatal):", error);
      }

      // --- Fallback-matrix ---
      if (!previousBlock && !crmBlock) {
        await prisma.conversationPrep.update({
          where: { id: prepRow.id },
          data: { status: "skipped", skip_reason: "no_sources" },
        });
        return { status: "skipped", skipReason: "no_sources" };
      }

      // --- Prompt bouwen ---
      const meetingBlock = [
        "## Komende meeting",
        `- Titel: ${meeting.title || "(geen titel)"}`,
        `- Gepland: ${meeting.startTime.toISOString()}`,
        `- Externe deelnemers: ${externalAttendees.join(", ")}`,
      ].join("\n");
      const contextBlock = [
        meetingBlock,
        previousBlock ??
          "## Analyse van het vorige gesprek\n(Geen eerder geanalyseerd gesprek met deze klant beschikbaar.)",
        crmBlock ??
          "## CRM-context (HubSpot)\n(Geen CRM-context beschikbaar.)",
      ].join("\n\n");

      const language = user.lang_code || "nl";
      const template = await prepAnalysisPromptService.getActiveContent();
      const prompt = template
        .replaceAll("{{language}}", language)
        .replace("{{context}}", contextBlock);

      const { model, tag, usesAdaptiveThinking } =
        await platformSettingsService.getAnalysisLiteLLMRoute();

      // --- LLM-call + strakke validatie (1 retry, bouwplan risico 4) ---
      let content: PrepContent;
      try {
        content = parsePrepContent(
          await completeChat(prompt, { userId }, { model, tag, usesAdaptiveThinking })
        );
      } catch (firstError) {
        console.warn("[Prep] First LLM output invalid, retrying:", firstError);
        content = parsePrepContent(
          await completeChat(prompt, { userId }, { model, tag, usesAdaptiveThinking })
        );
      }

      await prisma.conversationPrep.update({
        where: { id: prepRow.id },
        data: {
          status: "generated",
          skip_reason: null,
          content: content as object,
          hubspot_deal_id: hubspotDealId,
          prospect_account_id: prospectAccountId,
          source_conversation_ids: previousConversationId
            ? [previousConversationId]
            : [],
        },
      });

      if (!sendEmail) {
        return { status: "generated", prepId: prepRow.id, content };
      }

      // --- Mail (best-effort verzendstatus, maar wel gerapporteerd) ---
      const appUrl = process.env.APP_URL || "https://app.reppic.ai";
      await mailService.sendMeetingPrepEmailToUser({
        lang: language,
        appName: process.env.APP_NAME || "Reppic",
        emailFrom: process.env.EMAIL_FROM || "noreply@reppic.ai",
        userEmail: user.email,
        appUrl,
        prep: {
          userName: user.name,
          meetingTitle: meeting.title || "Meeting",
          meetingStart: meeting.startTime,
          prospectName: prospectDisplayName ?? resolved?.domain ?? null,
          content,
          previousConversationLink: previousConversationId
            ? `${appUrl}/conversations/${previousConversationId}`
            : null,
          lang: language,
        },
      });

      await prisma.conversationPrep.update({
        where: { id: prepRow.id },
        data: { status: "sent", email_sent_at: new Date() },
      });
      return { status: "sent", prepId: prepRow.id, content };
    } catch (error) {
      console.error(
        `[Prep] Generation failed for event ${meeting.calendarEventId}:`,
        error
      );
      await prisma.conversationPrep.update({
        where: { id: prepRow.id },
        data: { status: "failed", fail_count: { increment: 1 } },
      });
      return { status: "failed" };
    }
  },
};
