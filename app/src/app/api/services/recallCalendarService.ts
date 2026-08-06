import { RecallAIService } from "@/app/api/services/recallAIService";

/**
 * Per-verkoper agenda-koppeling via Recall Calendar v1.
 *
 * Ontwerpkeuzes (zie bouwplan):
 *  - Recall is de bron van waarheid voor de KOPPELSTATUS: die vragen we live op
 *    (GET /api/v1/calendar/user/), we cachen 'm niet in onze database. De echte
 *    agenda-tokens leven bij Recall en kunnen buiten ons om worden ingetrokken;
 *    een lokaal opgeslagen "gekoppeld: ja" zou dus kunnen verouderen.
 *  - Stateless auth: Reppic user-id = Recall external_id (zelfde patroon als de
 *    bestaande RecallAIService.getCalendarAuthToken).
 *  - De client-secret van de Google/Microsoft-app staat in het Recall-dashboard,
 *    niet in onze .env — Recall doet de code-exchange. Wij hebben aan onze kant
 *    alleen de (publieke) client-ID nodig om de authorize-URL te bouwen.
 */

// Zelfde regio als de bestaande RecallAIService (recallAIService.ts:1).
const RECALL_BASE_URL = "https://us-west-2.recall.ai";

export type CalendarPlatform = "google_calendar" | "microsoft_outlook";

export interface CalendarConnection {
  id: string;
  platform: string;
  email: string | null;
  connected: boolean;
}

export interface CalendarUser {
  id: string;
  external_id: string | null;
  connections: CalendarConnection[];
  preferences: Record<string, any> | null;
}

interface PlatformConfig {
  clientIdEnv: string;
  authorizeBase: string;
  scope: string;
  // Recall's OAuth-callback voor dit platform (redirect_uri richting Google/MS).
  recallCallbackPath: string;
  // De sleutel waaronder Recall die callback-URL in de state verwacht.
  stateRedirectKey: string;
  // Platform-specifieke extra authorize-parameters (Google en Microsoft
  // verschillen hierin wezenlijk — zie hieronder).
  extraParams: Record<string, string>;
}

const PLATFORMS: Record<CalendarPlatform, PlatformConfig> = {
  google_calendar: {
    clientIdEnv: "GOOGLE_OAUTH_CLIENT_ID",
    authorizeBase: "https://accounts.google.com/o/oauth2/v2/auth",
    scope:
      "https://www.googleapis.com/auth/calendar.events.readonly https://www.googleapis.com/auth/userinfo.email",
    recallCallbackPath: "/api/v1/calendar/google_oauth_callback/",
    stateRedirectKey: "google_oauth_redirect_url",
    // Google vereist access_type=offline + prompt=consent om een refresh token
    // te krijgen (zie recall-docs + bewezen tijdens de koppeling).
    extraParams: {
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
    },
  },
  microsoft_outlook: {
    // Waarden conform Recall Calendar V1 Microsoft-doc.
    clientIdEnv: "MICROSOFT_OAUTH_CLIENT_ID",
    authorizeBase:
      "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    // Volledige Graph-scope + offline_access (refresh token) + openid/email.
    scope:
      "offline_access openid email https://graph.microsoft.com/Calendars.Read",
    recallCallbackPath: "/api/v1/calendar/ms_oauth_callback/",
    stateRedirectKey: "ms_oauth_redirect_url",
    // Microsoft: response_mode=query; GEEN prompt=consent (Recall-doc raadt dat
    // in productie af) en GEEN access_type/include_granted_scopes (Google-only).
    extraParams: {
      response_mode: "query",
    },
  },
};

export class CalendarPlatformNotConfiguredError extends Error {
  constructor(platform: CalendarPlatform) {
    super(`Calendar platform ${platform} is not configured`);
    this.name = "CalendarPlatformNotConfiguredError";
  }
}

export class RecallCalendarService {
  /**
   * Haalt de live koppelstatus op bij Recall. Retourneert null als de gebruiker
   * (nog) geen calendar-user heeft of Recall een 4xx geeft — de caller vertaalt
   * dat naar "niet gekoppeld".
   */
  static async getCalendarUser(userId: string): Promise<CalendarUser | null> {
    const token = await RecallAIService.getCalendarAuthToken(userId);
    const response = await fetch(`${RECALL_BASE_URL}/api/v1/calendar/user/`, {
      method: "GET",
      headers: {
        "x-recallcalendarauthtoken": token,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      if (response.status >= 400 && response.status < 500) return null;
      const errorText = await response.text();
      throw new Error(
        `Get calendar user failed: ${response.status} ${errorText}`
      );
    }

    const data = await response.json();
    return {
      id: data.id,
      external_id: data.external_id ?? null,
      connections: Array.isArray(data.connections)
        ? data.connections.map((c: any) => ({
            id: String(c.id ?? ""),
            platform: String(c.platform ?? ""),
            email: c.email ?? null,
            connected: Boolean(c.connected),
          }))
        : [],
      preferences: data.preferences ?? null,
    };
  }

  /**
   * Compacte, UI-vriendelijke status: de eerste actieve verbinding (Recall v1
   * ondersteunt in de praktijk één actieve agenda per gebruiker).
   */
  static async getConnectionStatus(
    userId: string
  ): Promise<{ connected: boolean; platform: string | null; email: string | null }> {
    const calUser = await this.getCalendarUser(userId);
    const active = calUser?.connections.find((c) => c.connected);
    return {
      connected: Boolean(active),
      platform: active?.platform ?? null,
      email: active?.email ?? null,
    };
  }

  /**
   * Bouwt de OAuth-authorize-URL voor het gekozen platform. De agenda wordt aan
   * de Reppic-gebruiker gekoppeld via het recall_calendar_auth_token in de
   * state; Recall handelt de code-exchange af en redirect daarna naar success_url
   * of error_url op onze settings-pagina.
   */
  static async buildConnectUrl(
    userId: string,
    platform: CalendarPlatform,
    appBaseUrl: string
  ): Promise<string> {
    const config = PLATFORMS[platform];
    const clientId = process.env[config.clientIdEnv];
    if (!clientId) {
      throw new CalendarPlatformNotConfiguredError(platform);
    }

    const calendarAuthToken = await RecallAIService.getCalendarAuthToken(userId);
    const recallCallbackUrl = `${RECALL_BASE_URL}${config.recallCallbackPath}`;

    const state = JSON.stringify({
      recall_calendar_auth_token: calendarAuthToken,
      [config.stateRedirectKey]: recallCallbackUrl,
      success_url: `${appBaseUrl}/settings?calendar=connected`,
      error_url: `${appBaseUrl}/settings?calendar=error`,
    });

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: "code",
      redirect_uri: recallCallbackUrl,
      scope: config.scope,
      state,
      ...config.extraParams,
    });

    return `${config.authorizeBase}?${params.toString()}`;
  }

  /**
   * Leest de huidige opname-voorkeuren (om de exacte vorm te kennen vóórdat we
   * ze aanpassen — de Recall-docs specificeren de default niet). Best-effort.
   */
  static async getRecordingPreferences(
    userId: string
  ): Promise<Record<string, any> | null> {
    const calUser = await this.getCalendarUser(userId);
    return calUser?.preferences ?? null;
  }

  /**
   * Zet auto-opname expliciet UIT na een koppeling: de agenda-koppeling dient
   * puur om afspraken te LEZEN voor de gespreksvoorbereiding. Zo gaat er nooit
   * per ongeluk een tweede notetaker naar meetings naast de centrale notetaker.
   *
   * Best-effort en gelogd: faalt dit, dan blijft de koppeling bruikbaar voor het
   * lezen; we forceren de koppeling er niet op stuk. De exacte preference-vorm
   * wordt in de E2E-stap geverifieerd via getRecordingPreferences.
   */
  static async disableAutoRecording(userId: string): Promise<void> {
    try {
      const token = await RecallAIService.getCalendarAuthToken(userId);
      const response = await fetch(`${RECALL_BASE_URL}/api/v1/calendar/user/`, {
        method: "PATCH",
        headers: {
          "x-recallcalendarauthtoken": token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          preferences: {
            record_non_host: false,
            record_recurring: false,
            record_external: false,
            record_internal: false,
            record_confirmed: false,
            record_only_host: false,
          },
        }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.warn(
          `[RecallCalendar] disableAutoRecording non-OK: ${response.status} ${errorText}`
        );
      }
    } catch (error) {
      console.warn("[RecallCalendar] disableAutoRecording failed:", error);
    }
  }

  /**
   * Ontkoppelt een platform bij Recall.
   */
  static async disconnectPlatform(
    userId: string,
    platform: CalendarPlatform
  ): Promise<void> {
    const token = await RecallAIService.getCalendarAuthToken(userId);
    const response = await fetch(
      `${RECALL_BASE_URL}/api/v1/calendar/user/disconnect/`,
      {
        method: "POST",
        headers: {
          "x-recallcalendarauthtoken": token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ platform }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Disconnect calendar failed: ${response.status} ${errorText}`
      );
    }
  }
}
