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
// Webinar-achtige afspraken (veel deelnemers) zijn geen 1-op-1 klantgesprek.
const MAX_ATTENDEES = 8;
// Maximaal aantal eerdere gesprekken dat als bron meegaat in de prep.
const MAX_SOURCE_CONVERSATIONS = 3;

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

interface SourceConversation {
  id: string;
  created_at: Date;
  attendee_emails: unknown;
  user: { id: string; name: string } | null;
  conversation_summaries_x: Array<{
    summary_text: string | null;
    phases: unknown;
    resistances: unknown;
    total_score: number | null;
    created_at: Date;
    geen_salesgesprek: boolean;
  }>;
}

/** Eén gesprek-analyse als compact NL-tekstblok (prompt-INPUT; de output
 *  van de prep formuleert dit vooruitkijkend — zie prompt.md). */
function renderConversationSummary(
  conversation: SourceConversation,
  recipientUserId: string
): string {
  const summary = conversation.conversation_summaries_x[0];
  const lines: string[] = [];
  const date = summary.created_at.toISOString().slice(0, 10);
  const byColleague =
    conversation.user && conversation.user.id !== recipientUserId
      ? ` (gesprek gevoerd door ${conversation.user.name})`
      : "";
  lines.push(`### Gesprek van ${date}${byColleague}`);
  if (summary.total_score != null) {
    lines.push(`- Totaalscore: ${summary.total_score}`);
  }
  if (summary.summary_text) {
    lines.push(`- Samenvatting: ${summary.summary_text}`);
  }

  const phases = Array.isArray(summary.phases)
    ? (summary.phases as PhaseEntry[])
    : [];
  // Score-schaal is 0/1/3: 0 = niet behandeld, 1 = onvoldoende → nog open.
  const open = phases.filter(
    (p) => typeof p?.Score === "number" && p.Score <= 1
  );
  if (open.length > 0) {
    lines.push("- Nog openstaande onderwerpen (lage fase-score):");
    for (const phase of open) {
      const name = phase.Titel || `fase ${phase.Fase ?? "?"}`;
      lines.push(
        `  - ${name}${phase.Redenering ? `: ${phase.Redenering}` : ""}`
      );
    }
  }

  // Shape van resistances: {KlantWeerstand, VerkoperReactie, Conclusie, Reden}
  const resistances = Array.isArray(summary.resistances)
    ? (summary.resistances as Array<Record<string, unknown>>)
    : [];
  if (resistances.length > 0) {
    lines.push("- Geuite bezwaren/gevoeligheden:");
    for (const r of resistances) {
      const text =
        (r.KlantWeerstand as string) || JSON.stringify(r).slice(0, 200);
      const conclusion = r.Conclusie ? ` (status: ${r.Conclusie})` : "";
      lines.push(`  - ${text}${conclusion}`);
    }
  }
  return lines.join("\n");
}

/** Multi-gesprek-blok: max N recentste bruikbare gesprekken, bedrijfsbreed
 *  (ook van collega's, met bronvermelding). */
function buildPreviousConversationsBlock(
  conversations: SourceConversation[],
  recipientUserId: string
): string {
  const header =
    conversations.length === 1
      ? "## Analyse van het eerdere gesprek met deze klant"
      : `## Analyses van de ${conversations.length} meest recente gesprekken met deze klant (nieuwste eerst)`;
  return [
    header,
    ...conversations.map((c) => renderConversationSummary(c, recipientUserId)),
  ].join("\n\n");
}

/** Filtert bruikbare bron-gesprekken; optioneel gescoopt op de e-mailadressen
 *  van de contacten van de gevonden HubSpot-deal (per-deal context). */
function selectSourceConversations(
  conversations: SourceConversation[],
  dealContactEmails: string[]
): { selected: SourceConversation[]; dealScoped: boolean } {
  const usable = conversations.filter((c) => {
    const summary = c.conversation_summaries_x[0];
    return summary && !summary.geen_salesgesprek;
  });

  if (dealContactEmails.length > 0) {
    const dealSet = new Set(dealContactEmails);
    const scoped = usable.filter((c) => {
      const attendees = Array.isArray(c.attendee_emails)
        ? (c.attendee_emails as unknown[]).map((e) =>
            String(e).toLowerCase().trim()
          )
        : [];
      return attendees.some((e) => dealSet.has(e));
    });
    if (scoped.length > 0) {
      return {
        selected: scoped.slice(0, MAX_SOURCE_CONVERSATIONS),
        dealScoped: true,
      };
    }
    // Lege doorsnede (CRM-aliassen of oude gesprekken zonder attendees):
    // stil terugvallen op domein-niveau, wel loggen om te kwantificeren.
    console.log(
      "[Prep] Deal-scoping found no overlapping conversations; falling back to domain level."
    );
  }

  return {
    selected: usable.slice(0, MAX_SOURCE_CONVERSATIONS),
    dealScoped: false,
  };
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

    // --- Herkenning: webinars/grote sessies zijn geen 1-op-1 klantgesprek ---
    if (meeting.attendeeEmails.length > MAX_ATTENDEES) {
      const row = await upsertPrepRow({
        companyId,
        userId,
        meeting,
        prospectAccountId: null,
      });
      await prisma.conversationPrep.update({
        where: { id: row.id },
        data: { status: "skipped", skip_reason: "too_many_attendees" },
      });
      return { status: "skipped", skipReason: "too_many_attendees" };
    }

    // --- Externe deelnemers + prospect ---
    // Anker op de verkoper (Reppic-gebruiker), niet de organisator: als de
    // klant de afspraak organiseert, is de organisator juist de prospect.
    const notetakerExclude = process.env.NOTETAKER_EMAIL
      ? [process.env.NOTETAKER_EMAIL]
      : [];
    const externalAttendees = extractExternalAttendees(
      meeting.attendeeEmails,
      user.email,
      notetakerExclude
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
      user.email,
      notetakerExclude
    );
    const prospectAccountId = resolved?.prospectAccountId ?? null;
    const prepRow = await upsertPrepRow({
      companyId,
      userId,
      meeting,
      prospectAccountId,
    });

    try {
      // --- Bron 1: HubSpot-context (eerst, want de deal stuurt de scoping) ---
      let crmBlock: string | null = null;
      let hubspotDealId: string | null = null;
      let hubspotCompanyId: string | null = null;
      let prospectDisplayName: string | null = null;
      let dealContactEmails: string[] = [];
      try {
        for (const email of externalAttendees.slice(0, 3)) {
          const context = await HubspotService.findCrmContextByEmail(
            companyId,
            email
          );
          if (context) {
            crmBlock = HubspotService.buildCrmContextBlock(context);
            hubspotDealId = context.deal?.id ?? null;
            hubspotCompanyId = context.company?.id ?? null;
            prospectDisplayName =
              context.company?.name ||
              [context.contact?.firstName, context.contact?.lastName]
                .filter(Boolean)
                .join(" ") ||
              null;
            break;
          }
        }
        // Per-deal scoping: de contacten van de deal bepalen welke eerdere
        // gesprekken relevant zijn (i.p.v. alles op klant-domein).
        if (hubspotDealId) {
          dealContactEmails = await HubspotService.getDealContactEmails(
            companyId,
            hubspotDealId
          );
        }
      } catch (error) {
        // CRM-context is verrijking; nooit de prep laten falen op HubSpot.
        console.error("[Prep] HubSpot context failed (non-fatal):", error);
      }

      // HubSpot-company-id op de prospect vastleggen zodra bekend
      // (bestaand veld; maakt latere koppelingen betrouwbaarder).
      if (prospectAccountId && hubspotCompanyId) {
        prisma.prospectAccount
          .update({
            where: { id: prospectAccountId },
            data: { hubspot_company_id: hubspotCompanyId },
          })
          .catch(() => {});
      }

      // --- Bron 2: eerdere gesprekken (bedrijfsbreed; deal-gescoopt indien mogelijk) ---
      let previousBlock: string | null = null;
      let sourceConversationIds: string[] = [];
      if (prospectAccountId) {
        const conversations =
          (await ProspectAccountService.findConversationsForProspect(
            prospectAccountId
          )) as unknown as SourceConversation[];
        const { selected, dealScoped } = selectSourceConversations(
          conversations,
          dealContactEmails
        );
        if (selected.length > 0) {
          previousBlock = buildPreviousConversationsBlock(selected, userId);
          sourceConversationIds = selected.map((c) => c.id);
          if (dealScoped) {
            console.log(
              `[Prep] Deal-scoped sources: ${selected.length} conversation(s) for deal ${hubspotDealId}`
            );
          }
        }
      }
      const previousConversationId = sourceConversationIds[0] ?? null;

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
          "## Analyses van eerdere gesprekken\n(Geen eerder geanalyseerd gesprek met deze klant beschikbaar.)",
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
          source_conversation_ids: sourceConversationIds,
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
