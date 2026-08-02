import { prisma } from "../utils/prisma";
import { decryptSecret, encryptSecret } from "@/lib/crypto/secretBox";

// HubSpot-koppeling per tenant (Company) voor de gespreksvoorbereiding.
// Alleen-lezen CRM-context: contact → bedrijf → open deals (+ dealfase-
// labels) → recente notities. OAuth-tokens staan encrypted in
// hubspot_connections; refresh gebeurt onder een Postgres row-lock zodat
// gelijktijdige aanvragen niet dubbel refreshen.

const HUBSPOT_API = "https://api.hubapi.com";
const REFRESH_MARGIN_MS = 120_000; // refresh als token binnen 2 min verloopt

export const HUBSPOT_SCOPES = [
  "crm.objects.contacts.read",
  "crm.objects.companies.read",
  "crm.objects.deals.read",
  "crm.objects.notes.read",
  "oauth",
];

export interface HubspotDealSummary {
  id: string;
  name: string;
  stageLabel: string;
  pipelineLabel: string;
  amount: string | null;
  closeDate: string | null;
  lastModified: string;
}

export interface HubspotCrmContext {
  contact: { id: string; firstName: string | null; lastName: string | null; jobTitle: string | null } | null;
  company: { id: string; name: string | null; domain: string | null } | null;
  deal: HubspotDealSummary | null;
  otherOpenDealCount: number;
  recentNotes: Array<{ createdAt: string; preview: string }>;
}

interface OAuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

function getClientConfig() {
  const clientId = process.env.HUBSPOT_CLIENT_ID;
  const clientSecret = process.env.HUBSPOT_CLIENT_SECRET;
  const redirectUri = process.env.HUBSPOT_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "HubSpot OAuth is not configured (HUBSPOT_CLIENT_ID/SECRET/REDIRECT_URI)"
    );
  }
  return { clientId, clientSecret, redirectUri };
}

async function exchangeToken(
  params: Record<string, string>
): Promise<OAuthTokens> {
  const response = await fetch(`${HUBSPOT_API}/oauth/v1/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HubSpot token exchange failed: ${response.status} ${text}`);
  }
  return response.json();
}

// Cache voor pipeline-metadata (dealfase-labels), 10 min per portal.
const pipelineCache = new Map<
  string,
  { fetchedAt: number; stages: Map<string, { label: string; pipelineLabel: string; isClosed: boolean }> }
>();
const PIPELINE_CACHE_TTL_MS = 10 * 60 * 1000;

export class HubspotService {
  static buildAuthorizeUrl(state: string): string {
    const { clientId, redirectUri } = getClientConfig();
    const url = new URL("https://app.hubspot.com/oauth/authorize");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", HUBSPOT_SCOPES.join(" "));
    url.searchParams.set("state", state);
    return url.toString();
  }

  /** Wisselt de authorization code in en slaat de connectie encrypted op. */
  static async completeConnection(
    companyId: string,
    code: string,
    connectedBy: string
  ): Promise<{ portalId: string }> {
    const { clientId, clientSecret, redirectUri } = getClientConfig();
    const tokens = await exchangeToken({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code,
    });

    // Portal-id ophalen bij het token (hub_id).
    const infoRes = await fetch(
      `${HUBSPOT_API}/oauth/v1/access-tokens/${tokens.access_token}`
    );
    if (!infoRes.ok) {
      throw new Error(`HubSpot token introspection failed: ${infoRes.status}`);
    }
    const info = await infoRes.json();
    const portalId = String(info.hub_id ?? "");

    await prisma.hubspotConnection.upsert({
      where: { company_id: companyId },
      update: {
        portal_id: portalId,
        access_token_enc: encryptSecret(tokens.access_token),
        refresh_token_enc: encryptSecret(tokens.refresh_token),
        expires_at: new Date(Date.now() + tokens.expires_in * 1000),
        scopes: (info.scopes ?? []).join(" "),
        status: "active",
        connected_by: connectedBy,
      },
      create: {
        company_id: companyId,
        portal_id: portalId,
        access_token_enc: encryptSecret(tokens.access_token),
        refresh_token_enc: encryptSecret(tokens.refresh_token),
        expires_at: new Date(Date.now() + tokens.expires_in * 1000),
        scopes: (info.scopes ?? []).join(" "),
        status: "active",
        connected_by: connectedBy,
      },
    });

    return { portalId };
  }

  static async getConnectionStatus(companyId: string) {
    const conn = await prisma.hubspotConnection.findUnique({
      where: { company_id: companyId },
      select: {
        portal_id: true,
        status: true,
        created_at: true,
        updated_at: true,
      },
    });
    if (!conn) return { connected: false as const };
    return {
      connected: true as const,
      portalId: conn.portal_id,
      status: conn.status,
      connectedAt: conn.created_at,
    };
  }

  static async disconnect(companyId: string): Promise<void> {
    await prisma.hubspotConnection.deleteMany({
      where: { company_id: companyId },
    });
  }

  /**
   * Geldig access-token voor de tenant. Refresht onder een row-lock
   * (SELECT ... FOR UPDATE) zodat parallelle callers niet dubbel refreshen.
   * Bij een geweigerde refresh (portal-admin heeft de app ontkoppeld) wordt
   * de connectie op "broken" gezet en is de uitkomst null.
   */
  static async getValidAccessToken(companyId: string): Promise<string | null> {
    return prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        Array<{
          id: string;
          access_token_enc: string;
          refresh_token_enc: string;
          expires_at: Date;
          status: string;
        }>
      >`SELECT id, access_token_enc, refresh_token_enc, expires_at, status
        FROM hubspot_connections WHERE company_id = ${companyId} FOR UPDATE`;
      const conn = rows[0];
      if (!conn || conn.status !== "active") return null;

      if (conn.expires_at.getTime() - Date.now() > REFRESH_MARGIN_MS) {
        return decryptSecret(conn.access_token_enc);
      }

      const { clientId, clientSecret } = getClientConfig();
      try {
        const tokens = await exchangeToken({
          grant_type: "refresh_token",
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: decryptSecret(conn.refresh_token_enc),
        });
        await tx.hubspotConnection.update({
          where: { id: conn.id },
          data: {
            access_token_enc: encryptSecret(tokens.access_token),
            refresh_token_enc: encryptSecret(tokens.refresh_token),
            expires_at: new Date(Date.now() + tokens.expires_in * 1000),
          },
        });
        return tokens.access_token;
      } catch (error) {
        console.error(
          `[HubSpot] Token refresh failed for company ${companyId} — marking broken:`,
          error
        );
        await tx.hubspotConnection.update({
          where: { id: conn.id },
          data: { status: "broken" },
        });
        return null;
      }
    });
  }

  private static async apiGet(
    token: string,
    path: string
  ): Promise<any | null> {
    const response = await fetch(`${HUBSPOT_API}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.status === 404) return null;
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HubSpot GET ${path} failed: ${response.status} ${text}`);
    }
    return response.json();
  }

  private static async apiPost(
    token: string,
    path: string,
    body: unknown
  ): Promise<any> {
    const response = await fetch(`${HUBSPOT_API}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HubSpot POST ${path} failed: ${response.status} ${text}`);
    }
    return response.json();
  }

  /** Dealfase-labels + closed-vlag per stage-id, gecachet per portal. */
  private static async getStageMetadata(token: string, portalKey: string) {
    const cached = pipelineCache.get(portalKey);
    if (cached && Date.now() - cached.fetchedAt < PIPELINE_CACHE_TTL_MS) {
      return cached.stages;
    }
    const data = await this.apiGet(token, "/crm/v3/pipelines/deals");
    const stages = new Map<
      string,
      { label: string; pipelineLabel: string; isClosed: boolean }
    >();
    for (const pipeline of data?.results ?? []) {
      for (const stage of pipeline.stages ?? []) {
        stages.set(stage.id, {
          label: stage.label,
          pipelineLabel: pipeline.label,
          isClosed: stage.metadata?.isClosed === "true" || stage.metadata?.isClosed === true,
        });
      }
    }
    pipelineCache.set(portalKey, { fetchedAt: Date.now(), stages });
    return stages;
  }

  /**
   * CRM-context voor een prospect-e-mailadres: contact → bedrijf → meest
   * recent gewijzigde open deal (+ aantal overige) → recente notities.
   * Geeft null wanneer er geen actieve connectie is of het contact
   * onbekend is in HubSpot.
   */
  static async findCrmContextByEmail(
    companyId: string,
    email: string
  ): Promise<HubspotCrmContext | null> {
    const token = await this.getValidAccessToken(companyId);
    if (!token) return null;

    // 1) Contact op exact e-mailadres
    const contactSearch = await this.apiPost(token, "/crm/v3/objects/contacts/search", {
      filterGroups: [
        {
          filters: [
            { propertyName: "email", operator: "EQ", value: email.toLowerCase() },
          ],
        },
      ],
      properties: ["firstname", "lastname", "jobtitle", "associatedcompanyid"],
      limit: 1,
    });
    const contact = contactSearch?.results?.[0];
    if (!contact) return null;

    const context: HubspotCrmContext = {
      contact: {
        id: contact.id,
        firstName: contact.properties?.firstname ?? null,
        lastName: contact.properties?.lastname ?? null,
        jobTitle: contact.properties?.jobtitle ?? null,
      },
      company: null,
      deal: null,
      otherOpenDealCount: 0,
      recentNotes: [],
    };

    // 2) Geassocieerd bedrijf
    const companyAssoc = await this.apiGet(
      token,
      `/crm/v4/objects/contacts/${contact.id}/associations/companies?limit=1`
    );
    const hubspotCompanyId = companyAssoc?.results?.[0]?.toObjectId;
    if (hubspotCompanyId) {
      const company = await this.apiGet(
        token,
        `/crm/v3/objects/companies/${hubspotCompanyId}?properties=name,domain`
      );
      if (company) {
        context.company = {
          id: String(hubspotCompanyId),
          name: company.properties?.name ?? null,
          domain: company.properties?.domain ?? null,
        };
      }
    }

    // 3) Deals: via bedrijf (breedst) of anders via het contact
    const dealParentPath = hubspotCompanyId
      ? `/crm/v4/objects/companies/${hubspotCompanyId}/associations/deals?limit=100`
      : `/crm/v4/objects/contacts/${contact.id}/associations/deals?limit=100`;
    const dealAssoc = await this.apiGet(token, dealParentPath);
    const dealIds: string[] = (dealAssoc?.results ?? []).map((r: any) =>
      String(r.toObjectId)
    );

    if (dealIds.length > 0) {
      const stageMeta = await this.getStageMetadata(token, companyId);
      const batch = await this.apiPost(token, "/crm/v3/objects/deals/batch/read", {
        inputs: dealIds.slice(0, 100).map((id) => ({ id })),
        properties: [
          "dealname",
          "dealstage",
          "pipeline",
          "amount",
          "closedate",
          "hs_lastmodifieddate",
        ],
      });
      const openDeals = (batch?.results ?? [])
        .filter((d: any) => {
          const meta = stageMeta.get(d.properties?.dealstage);
          return meta ? !meta.isClosed : false;
        })
        .sort(
          (a: any, b: any) =>
            new Date(b.properties?.hs_lastmodifieddate ?? 0).getTime() -
            new Date(a.properties?.hs_lastmodifieddate ?? 0).getTime()
        );

      if (openDeals.length > 0) {
        const top = openDeals[0];
        const meta = stageMeta.get(top.properties?.dealstage);
        context.deal = {
          id: top.id,
          name: top.properties?.dealname ?? "(naamloze deal)",
          stageLabel: meta?.label ?? top.properties?.dealstage ?? "onbekend",
          pipelineLabel: meta?.pipelineLabel ?? "",
          amount: top.properties?.amount ?? null,
          closeDate: top.properties?.closedate ?? null,
          lastModified: top.properties?.hs_lastmodifieddate ?? "",
        };
        context.otherOpenDealCount = openDeals.length - 1;
      }
    }

    // 4) Recente notities bij de gekozen deal (of anders het contact)
    try {
      const noteParent = context.deal
        ? `/crm/v4/objects/deals/${context.deal.id}/associations/notes?limit=10`
        : `/crm/v4/objects/contacts/${contact.id}/associations/notes?limit=10`;
      const noteAssoc = await this.apiGet(token, noteParent);
      const noteIds: string[] = (noteAssoc?.results ?? [])
        .map((r: any) => String(r.toObjectId))
        .slice(0, 5);
      if (noteIds.length > 0) {
        const notes = await this.apiPost(token, "/crm/v3/objects/notes/batch/read", {
          inputs: noteIds.map((id) => ({ id })),
          properties: ["hs_note_body", "hs_createdate"],
        });
        context.recentNotes = (notes?.results ?? [])
          .map((n: any) => ({
            createdAt: n.properties?.hs_createdate ?? "",
            // Compact houden (AVG + prompt-omvang): alleen een preview.
            preview: String(n.properties?.hs_note_body ?? "")
              .replace(/<[^>]+>/g, " ")
              .replace(/\s+/g, " ")
              .trim()
              .slice(0, 300),
          }))
          .filter((n: any) => n.preview.length > 0)
          .sort(
            (a: any, b: any) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )
          .slice(0, 3);
      }
    } catch (error) {
      // Notities zijn nice-to-have; nooit de context laten falen.
      console.warn("[HubSpot] Notes lookup failed (non-fatal):", error);
    }

    return context;
  }

  /** Compact Nederlands tekstblok met CRM-context voor in de prep-prompt. */
  static buildCrmContextBlock(context: HubspotCrmContext): string {
    const lines: string[] = ["## CRM-context (HubSpot)"];
    if (context.contact) {
      const name = [context.contact.firstName, context.contact.lastName]
        .filter(Boolean)
        .join(" ");
      lines.push(
        `- Contactpersoon: ${name || "onbekend"}${
          context.contact.jobTitle ? ` (${context.contact.jobTitle})` : ""
        }`
      );
    }
    if (context.company?.name) {
      lines.push(`- Bedrijf: ${context.company.name}`);
    }
    if (context.deal) {
      lines.push(
        `- Open deal: "${context.deal.name}" — fase: ${context.deal.stageLabel}` +
          (context.deal.pipelineLabel
            ? ` (pipeline: ${context.deal.pipelineLabel})`
            : "")
      );
      if (context.deal.amount) {
        lines.push(`- Dealwaarde: ${context.deal.amount}`);
      }
      if (context.deal.closeDate) {
        lines.push(`- Verwachte sluitdatum: ${context.deal.closeDate}`);
      }
      if (context.otherOpenDealCount > 0) {
        lines.push(
          `- Let op: er ${
            context.otherOpenDealCount === 1
              ? "is nog 1 andere open deal"
              : `zijn nog ${context.otherOpenDealCount} andere open deals`
          } bij dit bedrijf.`
        );
      }
    } else {
      lines.push("- Geen open deal gevonden bij dit contact/bedrijf.");
    }
    for (const note of context.recentNotes) {
      const date = note.createdAt ? note.createdAt.slice(0, 10) : "";
      lines.push(`- Notitie${date ? ` (${date})` : ""}: ${note.preview}`);
    }
    return lines.join("\n");
  }
}
