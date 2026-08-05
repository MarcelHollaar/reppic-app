import type { PrepContent } from "@/lib/prep-analysis/promptSchema";

// HTML-opbouw van de gespreksvoorbereidings-mail. Secties zonder inhoud
// worden weggelaten (niet leeg getoond). De buitenste wrapper (logo/footer)
// komt van wrapEmailHtml in urlHelper.

export interface PrepEmailParams {
  userName: string;
  meetingTitle: string;
  meetingStart: Date;
  prospectName: string | null;
  content: PrepContent;
  previousConversationLink: string | null;
  lang: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const SECTION_STYLE =
  "margin:24px 0 8px 0; font-size:16px; font-weight:700; color:#1a1a2e;";
const LIST_STYLE = "margin:6px 0; padding-left:20px;";
const ITEM_STYLE = "margin-bottom:8px; line-height:1.5;";

export function buildPrepEmailHtml(
  params: PrepEmailParams,
  labels: {
    intro: string;
    meetingAt: string;
    goalTitle: string;
    infoGoalsTitle: string;
    questionsTitle: string;
    dealTitle: string;
    attentionTitle: string;
    previousConversation: string;
  }
): string {
  const { content } = params;
  const parts: string[] = [];

  const dateFmt = new Intl.DateTimeFormat(params.lang || "nl", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(params.meetingStart);

  parts.push(`<p style="line-height:1.5;">${escapeHtml(labels.intro)}</p>`);
  parts.push(
    `<p style="line-height:1.5;"><strong>${escapeHtml(
      params.meetingTitle
    )}</strong>${
      params.prospectName ? ` — ${escapeHtml(params.prospectName)}` : ""
    }<br/>${escapeHtml(labels.meetingAt)} ${escapeHtml(dateFmt)}</p>`
  );

  // Doel
  parts.push(`<h3 style="${SECTION_STYLE}">${escapeHtml(labels.goalTitle)}</h3>`);
  parts.push(`<p style="line-height:1.5;">${escapeHtml(content.doel)}</p>`);

  // Informatiedoelen — wat wil je dit gesprek leren/bereiken en waarom
  if (content.informatie_doelen.length > 0) {
    parts.push(
      `<h3 style="${SECTION_STYLE}">${escapeHtml(labels.infoGoalsTitle)}</h3>`
    );
    parts.push(`<ul style="${LIST_STYLE}">`);
    for (const item of content.informatie_doelen) {
      parts.push(
        `<li style="${ITEM_STYLE}"><strong>${escapeHtml(
          item.onderwerp
        )}</strong>${item.waarom ? ` — ${escapeHtml(item.waarom)}` : ""}</li>`
      );
    }
    parts.push("</ul>");
  }

  // Voorgestelde vragen
  if (content.voorgestelde_vragen.length > 0) {
    parts.push(
      `<h3 style="${SECTION_STYLE}">${escapeHtml(labels.questionsTitle)}</h3>`
    );
    parts.push(`<ol style="${LIST_STYLE}">`);
    for (const question of content.voorgestelde_vragen) {
      parts.push(`<li style="${ITEM_STYLE}">${escapeHtml(question)}</li>`);
    }
    parts.push("</ol>");
  }

  // Dealcontext
  if (content.deal_samenvatting) {
    parts.push(`<h3 style="${SECTION_STYLE}">${escapeHtml(labels.dealTitle)}</h3>`);
    parts.push(
      `<p style="line-height:1.5;">${escapeHtml(content.deal_samenvatting)}</p>`
    );
  }

  // Aandachtspunten
  if (content.aandachtspunten.length > 0) {
    parts.push(
      `<h3 style="${SECTION_STYLE}">${escapeHtml(labels.attentionTitle)}</h3>`
    );
    parts.push(`<ul style="${LIST_STYLE}">`);
    for (const point of content.aandachtspunten) {
      parts.push(`<li style="${ITEM_STYLE}">${escapeHtml(point)}</li>`);
    }
    parts.push("</ul>");
  }

  // Link naar het vorige gesprek
  if (params.previousConversationLink) {
    parts.push(
      `<p style="margin-top:24px;"><a href="${escapeHtml(
        params.previousConversationLink
      )}" style="color:#4353ff;">${escapeHtml(labels.previousConversation)}</a></p>`
    );
  }

  return parts.join("\n");
}

/** Plain-text-variant voor de mail (fallback voor html). */
export function buildPrepEmailText(
  params: PrepEmailParams,
  labels: Parameters<typeof buildPrepEmailHtml>[1]
): string {
  const { content } = params;
  const lines: string[] = [labels.intro, ""];
  lines.push(`${params.meetingTitle}${params.prospectName ? ` — ${params.prospectName}` : ""}`);
  lines.push("");
  lines.push(`${labels.goalTitle}: ${content.doel}`);
  if (content.informatie_doelen.length > 0) {
    lines.push("", labels.infoGoalsTitle);
    for (const item of content.informatie_doelen) {
      lines.push(`- ${item.onderwerp}${item.waarom ? ` — ${item.waarom}` : ""}`);
    }
  }
  if (content.voorgestelde_vragen.length > 0) {
    lines.push("", labels.questionsTitle);
    content.voorgestelde_vragen.forEach((q, i) => lines.push(`${i + 1}. ${q}`));
  }
  if (content.deal_samenvatting) {
    lines.push("", `${labels.dealTitle}: ${content.deal_samenvatting}`);
  }
  if (content.aandachtspunten.length > 0) {
    lines.push("", labels.attentionTitle);
    for (const point of content.aandachtspunten) {
      lines.push(`- ${point}`);
    }
  }
  return lines.join("\n");
}
