import jwt from "jsonwebtoken";

/**
 * Pushes a completed conversation transcript to the strategic/operational
 * dashboard backend so the exact same transcript becomes available for the
 * dashboard analysis (trends, PICA, resistance, next steps, DMU, etc.).
 *
 * The dashboard backend authenticates via a JWT signed with the SAME
 * JWT_SECRET that Reppic uses for its own access tokens, and reads
 * { id, email, role, company_id } from the payload. A regular company user's
 * token is automatically scoped to that user's company by the dashboard's
 * getCompanyFilter(), so the transcript lands in the correct company bucket.
 *
 * This call is intentionally non-blocking and never throws: a dashboard
 * outage or misconfiguration must not break conversation analysis or the
 * user-facing report emails.
 */

const JWT_SECRET = process.env.JWT_SECRET;
const DASHBOARD_API_URL =
  process.env.DASHBOARD_API_URL ||
  process.env.NEXT_PUBLIC_DASHBOARD_API_URL ||
  "http://localhost:5001";

const SUPPORTED_LANGUAGES = ["nl", "en", "de", "fr", "es", "it"] as const;

function normalizeLanguage(language?: string | null): string {
  const code = (language || "").toLowerCase().slice(0, 2);
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(code) ? code : "nl";
}

export type PushTranscriptParams = {
  userId: string;
  email: string;
  /** Role name, e.g. "user" | "manager" | "superadmin" */
  role?: string | null;
  /** Company the conversation belongs to (the salesperson's company) */
  companyId?: string | null;
  /** Conversation language (analysis language) */
  language?: string | null;
  /** Human-readable name shown in the dashboard transcript list */
  filename: string;
  /** Full transcript text */
  content: string;
  /**
   * Single-source-of-truth coaching analysis from the app (PICA etc.). When
   * present the dashboard backend uses it for the operational dashboard instead
   * of re-analysing, so operational and personal dashboards agree.
   */
  coachingAnalysis?: unknown;
};

export const DashboardSyncService = {
  async pushTranscript({
    userId,
    email,
    role,
    companyId,
    language,
    filename,
    content,
    coachingAnalysis,
  }: PushTranscriptParams): Promise<void> {
    try {
      if (!content || !content.trim()) {
        console.warn(
          "[DashboardSync] Empty transcript, skipping dashboard push",
        );
        return;
      }

      const token = jwt.sign(
        {
          id: userId,
          email,
          role: role || "user",
          company_id: companyId ?? null,
        },
        JWT_SECRET,
        { expiresIn: "5m" },
      );

      // Time-out: een trage/hangende dashboard-backend mag de gespreksanalyse
      // (en de daaropvolgende rapport-mails) niet onbepaald blokkeren.
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30000);
      let response: Response;
      try {
        response = await fetch(`${DASHBOARD_API_URL}/api/transcripts`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            filename,
            content,
            language: normalizeLanguage(language),
            status: "pending",
            isPdf: false,
            ...(coachingAnalysis ? { coachingAnalysis } : {}),
          }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        console.error(
          `[DashboardSync] Transcript push failed (${response.status}) for company ${companyId}: ${errorText}`,
        );
        return;
      }

      console.log(
        `[DashboardSync] Transcript pushed to dashboard for company ${companyId ?? "(none)"}`,
      );
    } catch (err) {
      console.error(
        "[DashboardSync] Error pushing transcript to dashboard:",
        err,
      );
    }
  },
};
