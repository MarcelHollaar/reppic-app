/**
 * Helpers for safely rendering AI/user-generated text via
 * dangerouslySetInnerHTML. The text is HTML-escaped first, then only a small
 * set of known-safe formatting markers is re-introduced — so injected markup
 * (e.g. `<img onerror=...>`) can never execute (stored XSS protection).
 */

/** Escape the five HTML special characters. */
export function escapeHtml(input: unknown): string {
  return String(input ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Render plain text that may contain `**bold**` markers and newlines as safe
 * HTML: everything is escaped, then `**...**` becomes <strong> and line breaks
 * become <br/>. Nothing else is interpreted as markup.
 */
export function formatBasicTextToSafeHtml(input: unknown): string {
  return escapeHtml(input)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\r?\n/g, "<br/>");
}

/**
 * Render an AI-generated conversation summary as safe HTML. Like
 * formatBasicTextToSafeHtml, but geared to the summary text: everything is
 * HTML-escaped FIRST, then a fixed set of formatting is re-introduced —
 * `**bold**`, blank-line paragraph gaps (a `.small-gap` spacer, styled inside a
 * `.custom-br` container), single newlines as <br/>, and stray markdown `#`
 * stripped. Because the escape happens before any tag is inserted, injected
 * markup can never render as HTML (fixes the dashboard showing literal
 * `<span class="small-gap">` tags, and keeps the stored-XSS protection intact).
 */
export function formatSummaryToSafeHtml(input: unknown): string {
  return escapeHtml(input)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\n{2,}/g, '<span class="small-gap"></span>')
    .replace(/\r?\n/g, "<br/>")
    .replace(/#/g, "");
}

/**
 * Sanitize an HTML video-embed snippet (iframe embeds) before injecting it via
 * dangerouslySetInnerHTML. Iframes/divs are kept, but the script-execution
 * vectors are removed: <script> blocks, inline event handlers (onerror, onload,
 * …), and javascript:/data-html URLs. Defense-in-depth for the superadmin-set
 * `embedded_code` field so a bad/compromised value can't run script in a
 * viewer's session and steal the token.
 */
export function sanitizeEmbedHtml(input: unknown): string {
  return String(input ?? "")
    // drop <script>…</script> entirely
    .replace(/<script[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<script[^>]*>/gi, "")
    // strip inline event handlers: on*="…" / on*='…' / on*=value
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "")
    .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, "")
    // neutralize javascript:/vbscript:/data:text-html URLs in attributes
    .replace(/(src|href)\s*=\s*"(\s*(javascript|vbscript|data:text\/html)[^"]*)"/gi, '$1="#"')
    .replace(/(src|href)\s*=\s*'(\s*(javascript|vbscript|data:text\/html)[^']*)'/gi, "$1='#'");
}

/**
 * Vertrouwde video-embed-hosts. Alleen iframes naar deze domeinen (of subdomein
 * daarvan) mogen worden ingesloten. Uitbreiden is bewust een codewijziging.
 */
const ALLOWED_EMBED_HOSTS = [
  "synthesia.io",
  "heygen.com",
  "youtube.com",
  "youtube-nocookie.com",
  "youtu.be",
  "vimeo.com",
  "google.com", // docs.google.com / drive.google.com (presentaties/pdf)
  "wistia.com",
  "loom.com",
];

/**
 * Haalt de eerste `<iframe src="…">` uit een embed-snippet en geeft die URL
 * ALLEEN terug als het een https-URL is naar een host op de allowlist. Zo
 * spelen de echte trainingsvideo's (Synthesia-iframes) af, terwijl we geen
 * ongefilterde HTML in de pagina injecteren — dat sluit de stored-XSS-route via
 * `video_embed_code` (o.a. via `srcdoc`/entity-encoded handlers) volledig af.
 * Retourneert null als er geen vertrouwde iframe-bron in zit.
 */
export function extractSafeEmbedUrl(input: unknown): string | null {
  const html = String(input ?? "");
  const iframe = /<iframe\b[^>]*\bsrc\s*=\s*("([^"]*)"|'([^']*)')/i.exec(html);
  // Geen iframe? Dan mag het veld ook een kale URL zijn (productie bewaart
  // document-/presentatiemodules als pad naar de PDF; de import herschrijft
  // dat naar een volledige DAM-URL).
  const raw = iframe?.[2] ?? iframe?.[3] ?? (html.includes("<") ? null : html);
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.toLowerCase();
  // Eigen DAM (waar PDF's/presentaties staan) is ook vertrouwd.
  const damHost = (() => {
    try {
      const base = process.env.NEXT_PUBLIC_FTP_PUBLIC_URL;
      return base ? new URL(base).hostname.toLowerCase() : null;
    } catch {
      return null;
    }
  })();
  const ok =
    (damHost && host === damHost) ||
    ALLOWED_EMBED_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  return ok ? url.toString() : null;
}
