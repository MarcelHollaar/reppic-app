/**
 * Full HTML document for the conversation evaluation / report email.
 * Table-based layout for client compatibility; hero/footer use transparent PNG in /public/img.
 */

export type ConversationSummaryEmailParts = {
  heroBadge: string;
  greeting: string;
  customerName: string;
  scoreBand: string;
  /** Preformatted score string (1 decimal, e.g. "8.0") — matches the dashboard. */
  totalScore: number | string;
  scoreStarsFilled: number;
  scoreLine: string;
  metricsHtml: string;
  summarySectionTitle: string;
  summaryBody: string;
  learningSectionTitle: string;
  learningList: string;
  insightsLink: string;
  ctaText: string;
  footer: string;
};

function escAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function starsRow(filled: number): string {
  const n = Math.min(5, Math.max(0, Math.round(filled)));
  const parts: string[] = [];
  for (let i = 0; i < 5; i++) {
    const color = i < n ? "#F97316" : "#D1D5DB";
    parts.push(
      `<span style="color:${color};font-size:22px;line-height:1;font-family:Georgia,serif;">&#9733;</span>`,
    );
  }
  return parts.join(
    '<span style="display:inline-block;width:6px;font-size:1px;">&nbsp;</span>',
  );
}

/**
 * Bold short section headings ("Concise summary (~150 words):", "Assessment:", "Conclusion:").
 * Lines starting with "- " stay normal (bullets under Conclusion, etc.).
 */
function enhanceSummaryBodyHtml(html: string): string {
  if (!html) return html;
  if (/<\s*p[\s>]/i.test(html) || /<\s*h[1-6][\s>]/i.test(html)) return html;
  return html
    .split(/<br\s*\/?>/i)
    .map((segment) => {
      const raw = segment;
      const t = segment.trim();
      if (!t) return raw;
      if (t.includes("://")) return raw;
      if (/^\s*-\s/.test(t)) return raw;
      const concise = t.match(/^(.+\(~\d+[^)]*\)\s*:)(\s*)(.*)$/);
      if (concise && concise[1].length >= 8 && concise[1].length <= 140) {
        return `<strong>${concise[1]}</strong>${concise[2]}${concise[3]}`;
      }
      const head = t.match(/^([^:]+:)(\s*)(.*)$/);
      if (head && head[1].length >= 3 && head[1].length <= 140) {
        return `<strong>${head[1]}</strong>${head[2]}${head[3]}`;
      }
      const oneWord = t.trim();
      if (
        /^(Assessment|Conclusion|Summary|Samenvatting|Beoordeling|Conclusie|Bewertung|Schlussfolgerung|Fazit|Évaluation|Résumé|Conclusión|Valutazione)$/iu.test(
          oneWord,
        )
      ) {
        return `<strong>${oneWord}</strong>`;
      }
      return raw;
    })
    .join("<br>");
}

export function wrapConversationSummaryEmailHtml(
  p: ConversationSummaryEmailParts,
  appUrl: string,
): string {
  const base = appUrl.replace(/\/$/, "");
  const brandLogoUrl = `${base}/img/reppic_logo_email.png`;
  const href = escAttr(p.insightsLink);
  // Use the pre-computed 0–5 star count (conversationReportMail halves the
  // 0–10 score). Do NOT re-derive from the 0–10 totalScore here, or the stars
  // would disagree with that single source of truth.
  const stars = starsRow(p.scoreStarsFilled);
  // Render the score exactly like the dashboard (total_score.toFixed(1)) so the
  // two never disagree. Do NOT round to an integer here.
  const scoreValue = Number(p.totalScore);
  const scoreNum = Number.isFinite(scoreValue) ? scoreValue.toFixed(1) : "0.0";
  const summaryInner = enhanceSummaryBodyHtml(p.summaryBody);

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:20px;box-shadow:0 4px 24px rgba(15,23,42,0.08);">
        <tr>
          <td style="padding:0;border-radius:20px 20px 0 0;background-color:#5870f6;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding:28px 24px 0 24px;">
                  <img src="${escAttr(brandLogoUrl)}" alt="Reppic" width="130" style="width:130px;max-width:72%;height:auto;display:block;margin:0 auto;border:0;">
                </td>
              </tr>
              <tr>
                <td align="center" style="padding:20px 24px 32px 24px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto;">
                    <tr><td align="center" style="padding:0 0 10px 0;">
                      <span style="display:inline-block;padding:7px 18px;border-radius:999px;background:rgba(255,255,255,0.26);font-size:11px;font-weight:700;letter-spacing:1.4px;color:#ffffff;text-transform:uppercase;">${p.heroBadge}</span>
                    </td></tr>
                    <tr><td align="center" style="padding:0 8px 8px 8px;font-size:28px;font-weight:800;line-height:1.2;color:#ffffff;">${p.customerName}</td></tr>
                    <tr><td align="center" style="padding:0 8px;font-size:14px;line-height:1.55;color:rgba(255,255,255,0.94);">${p.greeting}</td></tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 28px 8px 28px;font-size:15px;line-height:1.6;color:#333;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding:0 0 10px 0;">
                  <div style="display:inline-block;width:76px;height:76px;line-height:76px;text-align:center;border-radius:50%;background-color:#F97316;color:#ffffff;font-size:28px;font-weight:800;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;box-shadow:0 0 0 5px rgba(249,115,22,0.22),0 10px 28px rgba(249,115,22,0.38);">${scoreNum}</div>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding:0 0 10px 0;">${stars}</td>
              </tr>
              <tr>
                <td align="center" style="padding:0 0 8px 0;font-size:14px;font-weight:600;color:#EA580C;">${p.scoreLine}</td>
              </tr>
            </table>
            ${p.metricsHtml}
            <div style="margin:28px 0 12px 0;font-size:16px;font-weight:700;color:#111827;">&#128203; ${p.summarySectionTitle}</div>
            <div style="background-color:#F9FAFB;border:0;border-radius:14px;padding:18px 20px;font-size:14px;color:#374151;line-height:1.65;">${summaryInner}</div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0 12px 0;">
              <tr>
                <td style="width:4px;background-color:#F97316;border-radius:2px;font-size:1px;line-height:1px;">&nbsp;</td>
                <td style="padding:0 0 0 12px;font-size:16px;font-weight:700;color:#111827;">&#128218; ${p.learningSectionTitle}</td>
              </tr>
            </table>
            <div style="margin-bottom:8px;">${p.learningList}</div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0 18px 0;">
              <tr>
                <td align="center" style="padding:0;">
                  <a href="${href}" style="display:inline-block;background-color:#2563EB;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:15px 32px;border-radius:14px;box-shadow:0 6px 20px rgba(37,99,235,0.35);">${p.ctaText}</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 28px 28px 28px;background-color:#f9fafb;border-top:1px solid #eee;border-radius:0 0 20px 20px;text-align:center;">
            <img src="${escAttr(brandLogoUrl)}" alt="Reppic" width="100" style="width:100px;height:auto;display:block;margin:0 auto 12px auto;opacity:0.72;border:0;">
            <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;">Reppic &middot; ${p.footer}</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
