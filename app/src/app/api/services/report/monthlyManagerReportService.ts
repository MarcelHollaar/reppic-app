/**
 * Orchestratie van het maandelijkse manager-rapport.
 *
 * Voor elk bedrijf met managers: haal de dashboard-data van de vorige
 * kalendermaand op bij de dashboard-backend, bouw highlights (mail) + volledige
 * PDF, en verstuur per manager in diens eigen taal — met opt-out-check en
 * idempotentie per (bedrijf, periode).
 */

import i18next from "i18next";
import { prisma } from "@/app/api/utils/prisma";
import { USER_ROLE } from "@/configs/constants";
import { mailService } from "@/app/api/services/mailService";
import { fetchCompanyDashboards } from "./dashboardReportData";
import {
  hasReportData,
  mapOperational,
  mapStrategic,
  opCoreMetrics,
  stratCoreMetrics,
  type ReportLabels,
} from "./reportSections";
import { buildMonthlyReportPdf, type PdfStructuralLabels } from "./reportPdf";
import { generateMonthOverMonthNarrative } from "./monthOverMonthNarrative";

const SUPPORTED_LANGS = ["nl", "en", "de", "fr", "es", "it"];
/** Kleine pauze tussen verzendingen — respecteert SMTP-rate-limits. */
const SEND_DELAY_MS = 1100;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const LOCALE_MAP: Record<string, string> = {
  nl: "nl-NL", en: "en-US", de: "de-DE", fr: "fr-FR", es: "es-ES", it: "it-IT",
};

function normalizeLang(code?: string | null): string {
  const two = (code || "").toLowerCase().slice(0, 2);
  return SUPPORTED_LANGS.includes(two) ? two : "en";
}

/** Vorige kalendermaand t.o.v. `now`. Maand is 1-gebaseerd. */
export function previousMonth(now: Date): {
  year: number;
  month: number;
  periodKey: string;
} {
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  return { year, month, periodKey: `${year}-${String(month).padStart(2, "0")}` };
}

/** De maand vóór (year, month) — voor de maand-op-maand vergelijking. */
export function monthBefore(
  year: number,
  month: number,
): { year: number; month: number } {
  const d = new Date(year, month - 2, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

/** "juli 2026" in de taal van de ontvanger. */
function periodLabel(year: number, month: number, lang: string): string {
  return new Date(year, month - 1, 1).toLocaleDateString(
    LOCALE_MAP[lang] || "en-US",
    { month: "long", year: "numeric" },
  );
}

/** Alle labels voor mapping + PDF uit i18n, in één taal. */
async function labelsFor(lang: string): Promise<{
  report: ReportLabels;
  pdf: PdfStructuralLabels;
}> {
  await i18next.changeLanguage(lang);
  const t = (key: string) => i18next.t(`emails.monthlyReport.${key}`) as string;
  const reportKeys = [
    "operationalHeading", "strategicHeading",
    "totalConversations", "avgDuration", "avgPica", "clearNextStep",
    "nextStepClarity", "dmuClarity",
    "conversationCount", "totalNeeds", "categories", "positiveSentiment",
    "reportedIssues", "uniqueCompetitors",
    "keyMetrics", "phaseScores", "picaConclusion", "resistances", "triggers",
    "resistanceConclusion", "nextStepConclusion", "dmuConclusion",
    "topNeeds", "trendsConclusion", "topIssues", "satisfactionConclusion",
    "competitors", "strengths", "competitionConclusion", "execution",
    "resonance", "propositionConclusion",
    "biggestMovers", "planBasisNote", "momNarrativeHeading",
  ];
  const report: ReportLabels = {};
  for (const k of reportKeys) report[k] = t(k);
  const pdf: PdfStructuralLabels = {
    reportTitle: t("reportTitle"),
    generatedOn: t("generatedOn"),
    period: t("period"),
    confidential: t("confidential"),
    category: t("category"),
    value: t("value"),
    percentage: t("percentage"),
    total: t("total"),
    metric: t("metric"),
    noData: t("noData"),
    page: t("page"),
    of: t("of"),
    vsLastMonth: t("vsLastMonth"),
  };
  return { report, pdf };
}

type ManagerRow = {
  id: string;
  name: string;
  email: string;
  lang_code: string | null;
  user_settings: { notification_setting: unknown }[];
};

function wantsMonthlyReport(manager: ManagerRow): boolean {
  const settings = manager.user_settings?.[0]?.notification_setting as
    | { monthlyReport?: { email?: boolean } }
    | null
    | undefined;
  // Zelfde default als de bestaande reminder-gate: aan tenzij expliciet uit.
  return settings?.monthlyReport?.email ?? true;
}

export type MonthlyReportRunResult = {
  period: string;
  companies: {
    companyId: string;
    companyTitle: string;
    status: "sent" | "skipped_no_data" | "skipped_already_sent" | "error";
    recipients: string[];
    skippedRecipients: string[];
    error?: string;
  }[];
};

export async function runMonthlyManagerReports(options: {
  dryRun: boolean;
  now?: Date;
}): Promise<MonthlyReportRunResult> {
  const now = options.now ?? new Date();
  const { year, month, periodKey } = previousMonth(now);
  const result: MonthlyReportRunResult = { period: periodKey, companies: [] };

  const managerRole = await prisma.role.findFirst({
    where: { name: USER_ROLE.MANAGER },
  });
  if (!managerRole) {
    console.error("[MonthlyReport] Manager-rol niet gevonden — niets te doen");
    return result;
  }

  // Alleen bedrijven met minstens één actieve manager.
  const companies = await prisma.company.findMany({
    where: {
      users: { some: { role_id: managerRole.id, status: "active" } },
    },
    select: { id: true, title: true },
  });

  for (const company of companies) {
    const entry: MonthlyReportRunResult["companies"][number] = {
      companyId: company.id,
      companyTitle: company.title,
      status: "sent",
      recipients: [],
      skippedRecipients: [],
    };
    result.companies.push(entry);

    try {
      // Idempotentie: al verstuurd voor deze periode → overslaan.
      const already = await prisma.monthlyReportRun.findUnique({
        where: {
          company_id_period: { company_id: company.id, period: periodKey },
        },
      });
      if (already) {
        entry.status = "skipped_already_sent";
        continue;
      }

      const managers = (await prisma.user.findMany({
        where: {
          company_id: company.id,
          role_id: managerRole.id,
          status: "active",
        },
        select: {
          id: true,
          name: true,
          email: true,
          lang_code: true,
          user_settings: { select: { notification_setting: true } },
        },
      })) as ManagerRow[];
      if (managers.length === 0) {
        entry.status = "skipped_no_data";
        continue;
      }

      // Dashboard-snapshots zijn per taal opgeslagen; haal per benodigde taal
      // op zodat elke manager ziet wat zijn eigen dashboard toont. Voor de
      // maand-op-maand vergelijking halen we óók de maand ervoor op.
      const prevPeriod = monthBefore(year, month);
      const langs = [...new Set(managers.map((m) => normalizeLang(m.lang_code)))];
      const perLang = new Map<
        string,
        Awaited<ReturnType<typeof fetchCompanyDashboards>>
      >();
      const perLangPrev = new Map<
        string,
        Awaited<ReturnType<typeof fetchCompanyDashboards>>
      >();
      for (const lang of langs) {
        perLang.set(
          lang,
          await fetchCompanyDashboards(company.id, lang, year, month),
        );
        perLangPrev.set(
          lang,
          await fetchCompanyDashboards(
            company.id,
            lang,
            prevPeriod.year,
            prevPeriod.month,
          ),
        );
      }
      // AI-duiding één keer per taal (niet per manager) — en niet bij dryRun.
      const narrativeCache = new Map<
        string,
        { operational: string; strategic: string }
      >();

      // Bedrijf zonder data in de periode (in élke gebruikte taal) → geen mail.
      const anyData = [...perLang.values()].some((d) =>
        hasReportData(d.operational, d.strategic),
      );
      if (!anyData) {
        entry.status = "skipped_no_data";
        continue;
      }

      for (const manager of managers) {
        const lang = normalizeLang(manager.lang_code);
        const data = perLang.get(lang)!;

        if (!wantsMonthlyReport(manager)) {
          entry.skippedRecipients.push(manager.email);
          continue;
        }
        // Geen data in de taal van déze manager → sla deze manager over
        // (zijn eigen dashboard zou ook leeg zijn).
        if (!hasReportData(data.operational, data.strategic)) {
          entry.skippedRecipients.push(manager.email);
          continue;
        }

        const prevData = perLangPrev.get(lang);
        const hasPrev =
          !!prevData && hasReportData(prevData.operational, prevData.strategic);

        const { report: L, pdf: pdfLabels } = await labelsFor(lang);
        const opBlock = mapOperational(
          data.operational,
          L,
          hasPrev ? prevData.operational : undefined,
        );
        const stratBlock = mapStrategic(
          data.strategic,
          L,
          hasPrev ? prevData.strategic : undefined,
        );
        const period = periodLabel(year, month, lang);

        if (options.dryRun) {
          entry.recipients.push(`${manager.email} (dryRun)`);
          continue;
        }

        // Maand-op-maand AI-duiding (alleen als er een vorige maand is);
        // fail-open — lege strings laten het rapport gewoon doorgaan.
        let narrative = narrativeCache.get(lang);
        if (!narrative && hasPrev) {
          narrative = await generateMonthOverMonthNarrative({
            lang,
            periodLabel: period,
            prevPeriodLabel: periodLabel(
              prevPeriod.year,
              prevPeriod.month,
              lang,
            ),
            operational: {
              current: opCoreMetrics(data.operational),
              previous: opCoreMetrics(prevData.operational),
            },
            strategic: {
              current: stratCoreMetrics(data.strategic),
              previous: stratCoreMetrics(prevData.strategic),
            },
          });
          narrativeCache.set(lang, narrative);
        }
        if (narrative?.operational) {
          // Ná kerncijfers (+ evt. movers) in de PDF.
          opBlock.sections.splice(hasPrev ? 2 : 1, 0, {
            title: L.momNarrativeHeading,
            type: "text",
            data: narrative.operational,
          });
        }
        if (narrative?.strategic) {
          stratBlock.sections.splice(hasPrev ? 2 : 1, 0, {
            title: L.momNarrativeHeading,
            type: "text",
            data: narrative.strategic,
          });
        }

        const pdf = buildMonthlyReportPdf({
          companyTitle: company.title,
          periodLabel: period,
          lang,
          generatedOnText: now.toLocaleDateString(LOCALE_MAP[lang] || "en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          }),
          blocks: [opBlock, stratBlock],
          labels: pdfLabels,
        });

        await i18next.changeLanguage(lang);
        const attachmentBase = i18next.t(
          "emails.monthlyReport.attachmentName",
        ) as string;
        // Per manager afzonderlijk versturen: één mislukte verzending
        // (bijv. tijdelijke SMTP-fout) mag de overige managers niet blokkeren.
        try {
          await mailService.sendMonthlyManagerReport({
            to: manager.email,
            managerName: manager.name,
            companyTitle: company.title,
            periodLabel: period,
            lang,
            blocks: [
              {
                heading: opBlock.heading,
                highlights: opBlock.highlights,
                momSummary: narrative?.operational || undefined,
              },
              {
                heading: stratBlock.heading,
                highlights: stratBlock.highlights,
                momSummary: narrative?.strategic || undefined,
              },
            ],
            pdf,
            pdfFilename: `${attachmentBase}-${periodKey}.pdf`,
          });
          entry.recipients.push(manager.email);
        } catch (sendErr) {
          entry.skippedRecipients.push(manager.email);
          console.error(
            `[MonthlyReport] Verzenden aan ${manager.email} mislukt:`,
            sendErr,
          );
        }
        // Kleine pauze tegen SMTP-rate-limits.
        await sleep(SEND_DELAY_MS);
      }

      if (!options.dryRun && entry.recipients.length > 0) {
        await prisma.monthlyReportRun.create({
          data: {
            company_id: company.id,
            period: periodKey,
            recipients_count: entry.recipients.length,
          },
        });
      }
      if (entry.recipients.length === 0 && entry.status === "sent") {
        entry.status = "skipped_no_data";
      }
    } catch (err) {
      entry.status = "error";
      entry.error = err instanceof Error ? err.message : String(err);
      console.error(
        `[MonthlyReport] Fout voor bedrijf ${company.title}:`,
        err,
      );
    }
  }

  return result;
}
