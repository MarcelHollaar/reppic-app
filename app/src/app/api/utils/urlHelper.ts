export const getFullUrl = (
  relativePath: string,
  attachRoot = false,
): string => {
  const baseUrl = process.env.FTP_PUBLIC_URL;
  if (process.env.NEXT_PUBLIC_NODE_ENV === "production" && attachRoot) {
    return `${baseUrl}/${process.env.FTP_WEB_ROOT}/${relativePath}`.replace(
      /([^:]\/)\/+/g,
      "$1",
    );
  }
  return `${baseUrl}/${relativePath}`.replace(/([^:]\/)\/+/g, "$1");
};

// Helper to capitalize only the first letter, rest lowercase
export function capitalizeSubject(subject: string) {
  if (!subject) return "";
  // If subject starts with '¡' or '!', capitalize the next letter
  if (subject[0] === "¡" || subject[0] === "!") {
    if (subject.length > 1) {
      // Capitalize the second character, keep the rest as is
      return (
        subject[0] + subject[1].toUpperCase() + subject.slice(2).toLowerCase()
      );
    }
    return subject;
  }
  // Capitalize first letter, lowercase the rest, then restore OTP to uppercase everywhere
  let result = subject.charAt(0).toUpperCase() + subject.slice(1).toLowerCase();
  return result.replace(/\botp\b/gi, "OTP");
}

export function buildOtpEmailBody(options: {
  title: string;
  intro: string;
  otp: string;
  expiry: string;
  securityNote?: string;
}): string {
  const { title, intro, otp, expiry, securityNote } = options;
  const securityBlock = securityNote
    ? `<p style="margin:16px 0 0 0; color:#9ca3af; font-size:13px; line-height:1.5;">${securityNote}</p>`
    : "";

  return `
    <h1 style="margin:0 0 12px 0; font-size:22px; font-weight:600; color:#111827; line-height:1.3;">${title}</h1>
    <p style="margin:0 0 28px 0; color:#4b5563; font-size:15px; line-height:1.6;">${intro}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="padding:8px 0 28px 0;">
          <div style="display:inline-block; background:linear-gradient(180deg,#eef2ff 0%,#f8fafc 100%); border:2px solid #c7d2fe; border-radius:12px; padding:22px 36px; min-width:200px;">
            <span style="font-size:36px; font-weight:700; letter-spacing:10px; color:#1d4ed8; font-family:'Courier New',Courier,monospace;">${otp}</span>
          </div>
        </td>
      </tr>
    </table>
    <p style="margin:0; color:#6b7280; font-size:14px; line-height:1.5;">${expiry}</p>
    ${securityBlock}
  `;
}

// Simple wrapper used by existing transactional emails
export function wrapEmailHtml(html: string, appUrl: string) {
  const logoUrl = `${appUrl}/img/reppic_mobile.png`;
  return `
        <div style="font-family: Lato, sans-serif; font-size: 16px; color: #222;">
            ${html}
            <div style="margin-top:30px; text-align:start;">
                <img src="${logoUrl}" alt="Reppic Logo" style="width:100px; opacity:0.8;" />
            </div>
        </div>
    `;
}

// Branded card layout for login verification emails only
export function wrapBrandedEmailHtml(
  html: string,
  appUrl: string,
  footerHtml?: string,
) {
  const logoUrl = `${appUrl}/img/reppic_logo_email.png`;
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0; padding:0; background-color:#f4f5f7; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%; background-color:#ffffff; border-radius:8px; box-shadow:0 1px 4px rgba(0,0,0,0.08);">
        <tr><td style="padding:28px 36px 20px 36px; border-bottom:1px solid #eee;">
          <img src="${logoUrl}" alt="Reppic" width="110" style="width:110px; max-width:110px; display:block; border:0;">
        </td></tr>
        <tr><td style="padding:28px 36px 36px 36px; font-size:15px; line-height:1.6; color:#333;">
          ${html}
        </td></tr>
        <tr><td style="padding:20px 36px; background-color:#f9fafb; border-top:1px solid #eee; border-radius:0 0 8px 8px;">
          <p style="margin:0; font-size:12px; color:#9ca3af; line-height:1.5;">
            ${footerHtml ?? `This email was sent automatically by <a href="${appUrl}" style="color:#2563eb; text-decoration:none;">Reppic</a>.`}
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// Helper to format email body with line breaks and headers
export const formatEmailBody = (emailBody: string) => {
  return emailBody
    .replace(/(?:\n){2,}/g, "<br><br>") // Replace multiple '\n' with two '<br>' tags
    .replace(/\n/g, "<br>") // Replace single '\n' with '<br>'
    .replace(/^(#{1,6})\s*(.+)$/gm, (_, hashes, text) => {
      const headerLevel = hashes.length; // Determine header level based on the number of '#'
      return `<h${headerLevel}>${text}</h${headerLevel}>`;
    });
};

export function formatTwinAIEmailBody(emailBody: string): string {
  const lines = emailBody.split("\n");
  const htmlParts: string[] = [];
  let inUl = false;
  let inOl = false;

  function closeLists() {
    if (inUl) {
      htmlParts.push("</ul>");
      inUl = false;
    }
    if (inOl) {
      htmlParts.push("</ol>");
      inOl = false;
    }
  }

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === "") {
      closeLists();
      continue;
    }

    if (trimmed === "---" || trimmed === "***" || trimmed === "___") {
      closeLists();
      htmlParts.push(
        '<hr style="border:none; border-top:1px solid #e0e0e0; margin:24px 0;">',
      );
      continue;
    }

    const headerMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headerMatch) {
      closeLists();
      const level = headerMatch[1].length;
      const text = applyInlineFormatting(headerMatch[2]);
      const sizes: Record<number, string> = {
        1: "22px",
        2: "18px",
        3: "16px",
        4: "15px",
        5: "14px",
        6: "13px",
      };
      const fontSize = sizes[level] || "16px";
      const marginTop = level <= 2 ? "28px" : "20px";
      htmlParts.push(
        `<h${level} style="font-size:${fontSize}; color:#1a1a1a; margin:${marginTop} 0 8px 0; font-weight:600;">${text}</h${level}>`,
      );
      continue;
    }

    if (
      !inUl &&
      !inOl &&
      trimmed.length <= 80 &&
      trimmed.endsWith(":") &&
      !trimmed.startsWith("-") &&
      !trimmed.startsWith("*")
    ) {
      closeLists();
      const text = applyInlineFormatting(trimmed.slice(0, -1));
      htmlParts.push(
        `<h3 style="font-size:16px; color:#1a1a1a; margin:24px 0 8px 0; font-weight:600;">${text}</h3>`,
      );
      continue;
    }

    const ulMatch = trimmed.match(/^[-*]\s+(.+)$/);
    if (ulMatch) {
      if (inOl) {
        htmlParts.push("</ol>");
        inOl = false;
      }
      if (!inUl) {
        htmlParts.push('<ul style="margin:8px 0; padding-left:24px;">');
        inUl = true;
      }
      htmlParts.push(
        `<li style="margin-bottom:4px; color:#333;">${applyInlineFormatting(ulMatch[1])}</li>`,
      );
      continue;
    }

    const olMatch = trimmed.match(/^\d+\.\s+(.+)$/);
    if (olMatch) {
      if (inUl) {
        htmlParts.push("</ul>");
        inUl = false;
      }
      if (!inOl) {
        htmlParts.push('<ol style="margin:8px 0; padding-left:24px;">');
        inOl = true;
      }
      htmlParts.push(
        `<li style="margin-bottom:4px; color:#333;">${applyInlineFormatting(olMatch[1])}</li>`,
      );
      continue;
    }

    closeLists();
    htmlParts.push(
      `<p style="margin:0 0 12px 0; line-height:1.6; color:#333;">${applyInlineFormatting(trimmed)}</p>`,
    );
  }

  closeLists();
  return htmlParts.join("\n");
}

function applyInlineFormatting(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/__(.+?)__/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/_(.+?)_/g, "<em>$1</em>")
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g,
      '<a href="$2" style="color:#2563eb; text-decoration:none;">$1</a>',
    );
}

export function wrapTwinAIEmailHtml(html: string, appUrl: string): string {
  const logoUrl = `${appUrl}/img/reppic_mobile.png`;
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0; padding:0; background-color:#f4f5f7; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%; background-color:#ffffff; border-radius:8px; box-shadow:0 1px 4px rgba(0,0,0,0.08);">
        <tr><td style="padding:28px 36px 20px 36px; border-bottom:1px solid #eee;">
          <img src="${logoUrl}" alt="Reppic" style="width:110px; display:block;">
        </td></tr>
        <tr><td style="padding:28px 36px 36px 36px; font-size:15px; line-height:1.6; color:#333;">
          ${html}
        </td></tr>
        <tr><td style="padding:20px 36px; background-color:#f9fafb; border-top:1px solid #eee; border-radius:0 0 8px 8px;">
          <p style="margin:0; font-size:12px; color:#999; line-height:1.5;">
            Deze e-mail is automatisch gegenereerd door <a href="${appUrl}" style="color:#2563eb; text-decoration:none;">Reppic</a>. Neem contact op met je beheerder als je vragen hebt.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
