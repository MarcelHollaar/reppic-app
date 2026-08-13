import { BaseCrmProvider } from "./baseCrmProvider";
import { decryptSecret } from "@/lib/crypto/secretBox";
import type {
  ConnectionResult,
  CrmAccess,
  CrmConnectionRow,
  CrmContext,
  CrmProviderId,
  OAuthTokens,
} from "./types";
import { CrmProviderNotConfiguredError } from "./types";

// HubSpot-koppeling per tenant voor de gespreksvoorbereiding. Alleen-lezen
// CRM-context: contact → bedrijf → open deals (+ dealfase-labels) → recente
// notities.

const HUBSPOT_API = "https://api.hubapi.com";

const HUBSPOT_SCOPES = [
  "crm.objects.contacts.read",
  "crm.objects.companies.read",
  "crm.objects.deals.read",
  "oauth",
];

const PIPELINE_CACHE_TTL_MS = 10 * 60 * 1000;

export class HubspotProvider extends BaseCrmProvider {
  readonly id: CrmProviderId = "hubspot";
  readonly label = "HubSpot";

  // Dealfase-labels per portal, 10 min gecachet.
  private pipelineCache = new Map<
    string,
    {
      fetchedAt: number;
      stages: Map<string, { label: string; pipelineLabel: string; isClosed: boolean }>;
    }
  >();

  private config():
    | { clientId: string; clientSecret: string; redirectUri: string }
    | null {
    const clientId = process.env.HUBSPOT_CLIENT_ID;
    const clientSecret = process.env.HUBSPOT_CLIENT_SECRET;
    const redirectUri = process.env.HUBSPOT_REDIRECT_URI;
    if (!clientId || !clientSecret || !redirectUri) return null;
    return { clientId, clientSecret, redirectUri };
  }

  private requireConfig() {
    const cfg = this.config();
    if (!cfg) throw new CrmProviderNotConfiguredError(this.id);
    return cfg;
  }

  isConfigured(): boolean {
    return this.config() !== null;
  }

  buildAuthorizeUrl(state: string): string {
    const { clientId, redirectUri } = this.requireConfig();
    const url = new URL("https://app.hubspot.com/oauth/authorize");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", HUBSPOT_SCOPES.join(" "));
    url.searchParams.set("state", state);
    return url.toString();
  }

  private async exchangeToken(
    params: Record<string, string>
  ): Promise<OAuthTokens> {
    const response = await fetch(`${HUBSPOT_API}/oauth/v1/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(params).toString(),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `HubSpot token exchange failed: ${response.status} ${text}`
      );
    }
    return response.json();
  }

  protected async exchangeAuthCode(code: string): Promise<ConnectionResult> {
    const { clientId, clientSecret, redirectUri } = this.requireConfig();
    const tokens = await this.exchangeToken({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code,
    });

    // Portal-id + scopes ophalen bij het token (hub_id).
    const infoRes = await fetch(
      `${HUBSPOT_API}/oauth/v1/access-tokens/${tokens.access_token}`
    );
    if (!infoRes.ok) {
      throw new Error(
        `HubSpot token introspection failed: ${infoRes.status}`
      );
    }
    const info = await infoRes.json();
    return {
      tokens,
      externalAccountId: String(info.hub_id ?? ""),
      instanceUrl: null,
      scopes: (info.scopes ?? []).join(" "),
    };
  }

  protected async refreshTokens(
    conn: CrmConnectionRow
  ): Promise<OAuthTokens> {
    const { clientId, clientSecret } = this.requireConfig();
    return this.exchangeToken({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: decryptSecret(conn.refresh_token_enc),
    });
  }

  private async apiGet(token: string, path: string): Promise<any | null> {
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

  private async apiPost(
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

  private async getStageMetadata(token: string, portalKey: string) {
    const cached = this.pipelineCache.get(portalKey);
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
          isClosed:
            stage.metadata?.isClosed === "true" ||
            stage.metadata?.isClosed === true,
        });
      }
    }
    this.pipelineCache.set(portalKey, { fetchedAt: Date.now(), stages });
    return stages;
  }

  protected async fetchCrmContextByEmail(
    access: CrmAccess,
    email: string
  ): Promise<CrmContext | null> {
    const token = access.token;

    // 1) Contact op exact e-mailadres
    const contactSearch = await this.apiPost(
      token,
      "/crm/v3/objects/contacts/search",
      {
        filterGroups: [
          {
            filters: [
              {
                propertyName: "email",
                operator: "EQ",
                value: email.toLowerCase(),
              },
            ],
          },
        ],
        properties: ["firstname", "lastname", "jobtitle", "associatedcompanyid"],
        limit: 1,
      }
    );
    const contact = contactSearch?.results?.[0];
    if (!contact) return null;

    const context: CrmContext = {
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

    // 3) Deals: via bedrijf ÉN via het contact (samengevoegd). In de praktijk
    // hangen deals regelmatig alleen aan het contact en niet aan het bedrijf.
    const dealIdSet = new Set<string>();
    const contactDeals = await this.apiGet(
      token,
      `/crm/v4/objects/contacts/${contact.id}/associations/deals?limit=100`
    );
    for (const r of contactDeals?.results ?? []) {
      dealIdSet.add(String(r.toObjectId));
    }
    if (hubspotCompanyId) {
      const companyDeals = await this.apiGet(
        token,
        `/crm/v4/objects/companies/${hubspotCompanyId}/associations/deals?limit=100`
      );
      for (const r of companyDeals?.results ?? []) {
        dealIdSet.add(String(r.toObjectId));
      }
    }
    const dealIds: string[] = [...dealIdSet];

    if (dealIds.length > 0) {
      const stageMeta = await this.getStageMetadata(
        token,
        access.instanceUrl ?? this.id
      );
      const batch = await this.apiPost(
        token,
        "/crm/v3/objects/deals/batch/read",
        {
          inputs: dealIds.slice(0, 100).map((id) => ({ id })),
          properties: [
            "dealname",
            "dealstage",
            "pipeline",
            "amount",
            "closedate",
            "hs_lastmodifieddate",
          ],
        }
      );
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
        const notes = await this.apiPost(
          token,
          "/crm/v3/objects/notes/batch/read",
          {
            inputs: noteIds.map((id) => ({ id })),
            properties: ["hs_note_body", "hs_createdate"],
          }
        );
        context.recentNotes = (notes?.results ?? [])
          .map((n: any) => ({
            createdAt: n.properties?.hs_createdate ?? "",
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
      console.warn("[HubSpot] Notes lookup failed (non-fatal):", error);
    }

    return context;
  }

  protected async fetchDealContactEmails(
    access: CrmAccess,
    dealId: string
  ): Promise<string[]> {
    const token = access.token;
    const assoc = await this.apiGet(
      token,
      `/crm/v4/objects/deals/${dealId}/associations/contacts?limit=100`
    );
    const contactIds: string[] = (assoc?.results ?? []).map((r: any) =>
      String(r.toObjectId)
    );
    if (contactIds.length === 0) return [];

    const batch = await this.apiPost(
      token,
      "/crm/v3/objects/contacts/batch/read",
      {
        inputs: contactIds.slice(0, 100).map((id) => ({ id })),
        properties: ["email"],
      }
    );
    const emails = (batch?.results ?? [])
      .map((c: any) => String(c.properties?.email ?? "").toLowerCase().trim())
      .filter((e: string) => e.includes("@"));
    return [...new Set(emails)] as string[];
  }
}
