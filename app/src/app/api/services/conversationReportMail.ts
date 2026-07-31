import i18next from "i18next";
import { formatEmailBody } from "../utils/urlHelper";
import type { ConversationSummaryEmailParts } from "../utils/conversationSummaryEmailHtml";

const REPORT_DATE_LOCALE: Record<string, string> = {
  nl: "nl-NL",
  en: "en-US",
  de: "de-DE",
  fr: "fr-FR",
  es: "es-ES",
  it: "it-IT",
};

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type ConversationReportMailPayload = {
  lang: string;
  appUrl: string;
  userName: string;
  customerName: string;
  conversationId: string;
  conversationCreatedAt: string | null | undefined;
  totalScore: number;
  atmosphereRaw: string;
  salespersonPercentage: number | null;
  fileDurationSeconds: number | null | undefined;
  summaryText: string;
  learningPoints: string[];
};

/** Placeholders for conversation report HTML (via wrapConversationSummaryEmailHtml) and conversationReportText. */
export function buildConversationReportMailParts(
  p: ConversationReportMailPayload,
): ConversationSummaryEmailParts & Record<string, string | number> {
  const loc = REPORT_DATE_LOCALE[p.lang] || "en-US";
  let dateStr = "";
  try {
    const d = p.conversationCreatedAt
      ? new Date(p.conversationCreatedAt)
      : new Date();
    dateStr = d.toLocaleDateString(loc, {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    /* ignore */
  }

  const greeting = i18next.t("emails.conversationReport.greeting", {
    date: dateStr,
    userName: esc(p.userName),
  });
  const customerSafe = esc(p.customerName || "\u2014");

  const n = p.totalScore;
  const scoreBand =
    n >= 9
      ? i18next.t("emails.conversationReport.scoreExcellent")
      : n >= 7
        ? i18next.t("emails.conversationReport.scoreGood")
        : n >= 5
          ? i18next.t("emails.conversationReport.scoreSufficient")
          : n >= 3
            ? i18next.t("emails.conversationReport.scoreMediocre")
            : i18next.t("emails.conversationReport.scorePoor");

  const rawAtm = p.atmosphereRaw?.trim();
  const atmosphereDisplay = rawAtm
    ? i18next.t(`atmosphereValues.${rawAtm}`, { defaultValue: esc(rawAtm) })
    : "\u2014";

  const pct = p.salespersonPercentage;
  const balanceVal =
    pct != null && !Number.isNaN(pct) ? `${Math.round(pct)}%` : "\u2014";
  const balSub = (() => {
    if (pct == null || Number.isNaN(pct)) return "\u00A0";
    if (pct >= 65 && pct <= 80)
      return i18next.t("emails.conversationReport.balanceOptimal");
    if (pct > 80)
      return i18next.t("emails.conversationReport.balanceTooDominant");
    if (pct >= 50)
      return i18next.t("emails.conversationReport.balanceSuboptimal");
    return i18next.t("emails.conversationReport.balancePoor");
  })();

  const secIn = p.fileDurationSeconds;
  let durationVal = i18next.t("emails.conversationReport.noDuration");
  if (secIn != null && Number.isFinite(secIn) && secIn > 0) {
    const s = Math.round(secIn);
    if (s < 60) {
      durationVal = i18next.t("emails.conversationReport.durationSeconds", {
        s,
      });
    } else {
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      const sec = s % 60;
      durationVal =
        h > 0
          ? i18next.t("emails.conversationReport.durationHours", {
              h,
              m: String(m).padStart(2, "0"),
            })
          : i18next.t("emails.conversationReport.durationMinutes", {
              m,
              s: String(sec).padStart(2, "0"),
            });
    }
  }

  const lb = i18next.t("emails.conversationReport.metricBalance");
  const la = i18next.t("emails.conversationReport.metricAtmosphere");
  const ld = i18next.t("emails.conversationReport.metricDuration");

  const metricCard = (
    icon: string,
    bg: string,
    border: string,
    cellPad: string,
    label: string,
    value: string,
    sub: string,
    labelTone: string,
    valueTone: string,
    subTone: string,
  ) =>
    `<td style="width:33%;vertical-align:top;${cellPad}"><table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:${bg};border:1px solid ${border};border-radius:14px;"><tr><td style="padding:14px 12px 14px;font-family:Lato,Helvetica,sans-serif;"><div style="font-size:20px;line-height:1;margin-bottom:10px;">${icon}</div><div style="font-size:10px;text-transform:uppercase;color:${labelTone};font-weight:700;letter-spacing:0.5px;">${esc(label)}</div><div style="font-size:18px;font-weight:800;color:${valueTone};margin-top:8px;line-height:1.2;">${value}</div><div style="font-size:11px;color:${subTone};margin-top:6px;min-height:16px;">${sub}</div></td></tr></table></td>`;

  const metricBorder = "#E5E7EB";
  const metricLabelGray = "#6B7280";
  const metricGreen = "#047857";
  const metricBlue = "#1D4ED8";
  const metricsHtml = `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 24px;border-collapse:collapse;"><tr>${metricCard("&#128172;", "#ECFDF5", metricBorder, "padding:0 6px 0 0;", lb, esc(balanceVal), esc(pct != null && !Number.isNaN(pct) ? balSub : "\u00A0"), metricLabelGray, metricGreen, metricGreen)}${metricCard("&#9728;&#65039;", "#ECFDF5", metricBorder, "padding:0 6px 0 0;", la, esc(atmosphereDisplay), "\u00A0", metricLabelGray, metricGreen, metricGreen)}${metricCard("&#9201;&#65039;", "#EEF2FF", metricBorder, "padding:0;", ld, esc(durationVal), "\u00A0", metricLabelGray, metricBlue, metricBlue)}</tr></table>`;

  const metricsPlain = [
    pct != null && !Number.isNaN(pct)
      ? `${lb}: ${balanceVal} (${balSub})`
      : `${lb}: ${balanceVal}`,
    `${la}: ${atmosphereDisplay}`,
    `${ld}: ${durationVal}`,
  ].join("\n");

  const summarySafe = esc(p.summaryText || "");
  const summaryBody = summarySafe.trim()
    ? formatEmailBody(summarySafe)
    : `<p style="margin:0;color:#6B7280;">\u2014</p>`;
  const summaryPlain = (p.summaryText || "").trim() || "\u2014";

  const lp = Array.isArray(p.learningPoints) ? p.learningPoints : [];
  const learningRowStyles = [
    { bg: "#EFF6FF", dot: "#2563EB" },
    { bg: "#ECFDF5", dot: "#059669" },
    { bg: "#FFFBEB", dot: "#D97706" },
    { bg: "#F5F3FF", dot: "#7C3AED" },
  ];
  const learningList =
    lp.length > 0
      ? lp
          .map((x, i) => {
            const s = learningRowStyles[i % 4];
            return `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 12px;border-collapse:collapse;background:${s.bg};border:0;border-radius:12px;"><tr><td style="width:6px;background:${s.dot};border-radius:12px 0 0 12px;font-size:1px;line-height:1px;">&nbsp;</td><td style="padding:12px 16px 12px 12px;vertical-align:middle;"><table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr><td style="width:40px;padding:0 12px 0 0;vertical-align:middle;"><div style="width:28px;height:28px;line-height:28px;text-align:center;border-radius:50%;background:${s.dot};color:#ffffff;font-weight:800;font-size:14px;font-family:Lato,Helvetica,sans-serif;">${i + 1}</div></td><td style="vertical-align:middle;font-family:Lato,Helvetica,sans-serif;font-size:14px;color:#111827;line-height:1.45;">${esc(x)}</td></tr></table></td></tr></table>`;
          })
          .join("")
      : `<p style="margin:0;color:#6B7280;">\u2014</p>`;
  const learningPlain =
    lp.length > 0 ? lp.map((t, i) => `${i + 1}. ${t}`).join("\n") : "\u2014";

  const insightsLink = `${p.appUrl.replace(/\/$/, "")}/conversations/insights/${p.conversationId}`;

  const heroBadge = esc(i18next.t("emails.conversationReport.heroBadge"));
  // Always render the score with exactly one decimal — identical to the
  // dashboard (total_score.toFixed(1)) — so the two never differ by rounding.
  const totalScoreDisplay = Number.isFinite(Number(p.totalScore))
    ? Number(p.totalScore).toFixed(1)
    : "0.0";
  const scoreLine = esc(
    i18next.t("emails.conversationReport.scoreLine", {
      scoreBand,
      totalScore: totalScoreDisplay,
    }),
  );
  /**
   * Stars are a 0–5 rendering of the 0–10 total score, so halve it:
   * 10 → 5 stars, 5 → 2–3 stars, 2 → 1 star. The big number and the score
   * line stay on the 0–10 scale; only the star count is rebased to 0–5.
   */
  const scoreStarsFilled = Math.min(5, Math.max(0, Math.round(Number(n) / 2)));

  return {
    heroBadge,
    greeting,
    customerName: customerSafe,
    scoreBand,
    totalScore: totalScoreDisplay,
    scoreStarsFilled,
    scoreLine,
    metricsHtml,
    metricsPlain,
    summarySectionTitle: esc(
      i18next.t("emails.conversationReport.summarySectionTitle"),
    ),
    summaryBody,
    summaryPlain,
    learningSectionTitle: esc(
      i18next.t("emails.conversationReport.learningSectionTitle"),
    ),
    learningList,
    learningPlain,
    insightsLink,
    ctaText: esc(i18next.t("emails.conversationReport.ctaInsights")),
    footer: esc(i18next.t("emails.conversationReport.footerDisclaimer")),
  };
}
