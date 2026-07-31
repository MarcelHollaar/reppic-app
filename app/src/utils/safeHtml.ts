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
