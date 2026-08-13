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

// Microsoft Dynamics 365 Sales-koppeling per tenant. OAuth via Microsoft Entra
// (Azure AD, v2-endpoint, multi-tenant → admin-consent per klant-tenant). De
// org-URL van de klant (bijv. https://org.crm4.dynamics.com) is zowel de
// API-basis als de OAuth-scope ({orgUrl}/.default) en moet dus vóór de
// autorisatie bekend zijn. Read-only via OData v4:
// contact → account → open opportunity (statecode = 0) → annotations (notities).

const API_PATH = "/api/data/v9.2";

export class DynamicsProvider extends BaseCrmProvider {
  readonly id: CrmProviderId = "dynamics";
  readonly label = "Microsoft Dynamics 365";

  private config():
    | {
        clientId: string;
        clientSecret: string;
        redirectUri: string;
        tenant: string;
      }
    | null {
    const clientId = process.env.DYNAMICS_CLIENT_ID;
    const clientSecret = process.env.DYNAMICS_CLIENT_SECRET;
    const redirectUri = process.env.DYNAMICS_REDIRECT_URI;
    if (!clientId || !clientSecret || !redirectUri) return null;
    return {
      clientId,
      clientSecret,
      redirectUri,
      // "organizations" = alleen werk/school-accounts (multi-tenant).
      tenant: process.env.DYNAMICS_TENANT || "organizations",
    };
  }

  private requireConfig() {
    const cfg = this.config();
    if (!cfg) throw new CrmProviderNotConfiguredError(this.id);
    return cfg;
  }

  isConfigured(): boolean {
    return this.config() !== null;
  }

  private static normalizeOrgUrl(raw: string | undefined): string {
    if (!raw) {
      throw new Error(
        "Dynamics vereist de org-URL (instance_url), bijv. https://org.crm4.dynamics.com"
      );
    }
    // Zonder pad/slash; alleen de origin.
    const url = new URL(raw.includes("://") ? raw : `https://${raw}`);
    return url.origin;
  }

  buildAuthorizeUrl(state: string, params?: Record<string, string>): string {
    const { clientId, redirectUri, tenant } = this.requireConfig();
    const orgUrl = DynamicsProvider.normalizeOrgUrl(params?.instance_url);
    const url = new URL(
      `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`
    );
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_mode", "query");
    // offline_access → refresh-token; {orgUrl}/.default → toegang tot de org.
    url.searchParams.set("scope", `${orgUrl}/.default offline_access`);
    url.searchParams.set("state", state);
    return url.toString();
  }

  private async tokenRequest(
    orgUrl: string,
    params: Record<string, string>
  ): Promise<{ access_token: string; refresh_token?: string; expires_in: number }> {
    const { tenant } = this.requireConfig();
    const response = await fetch(
      `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          ...params,
          scope: `${orgUrl}/.default offline_access`,
        }).toString(),
      }
    );
    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Dynamics token request failed: ${response.status} ${text}`
      );
    }
    return response.json();
  }

  protected async exchangeAuthCode(
    code: string,
    params?: Record<string, string>
  ): Promise<ConnectionResult> {
    const { clientId, clientSecret, redirectUri } = this.requireConfig();
    const orgUrl = DynamicsProvider.normalizeOrgUrl(params?.instance_url);
    const res = await this.tokenRequest(orgUrl, {
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code,
    });

    // Org-id ophalen via WhoAmI (identificeert de organisatie eenduidig).
    let orgId = orgUrl;
    try {
      const who = await this.odataGet(
        { token: res.access_token, instanceUrl: orgUrl },
        "/WhoAmI"
      );
      if (who?.OrganizationId) orgId = who.OrganizationId;
    } catch {
      // Niet-kritiek: bij falen gebruiken we de org-URL als identifier.
    }

    return {
      tokens: {
        access_token: res.access_token,
        refresh_token: res.refresh_token ?? "",
        expires_in: res.expires_in,
      },
      externalAccountId: orgId,
      instanceUrl: orgUrl,
      scopes: `${orgUrl}/.default`,
    };
  }

  protected async refreshTokens(
    conn: CrmConnectionRow
  ): Promise<OAuthTokens> {
    const { clientId, clientSecret } = this.requireConfig();
    const orgUrl = DynamicsProvider.normalizeOrgUrl(
      conn.instance_url ?? undefined
    );
    const res = await this.tokenRequest(orgUrl, {
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: decryptSecret(conn.refresh_token_enc),
    });
    return {
      access_token: res.access_token,
      refresh_token: res.refresh_token ?? decryptSecret(conn.refresh_token_enc),
      expires_in: res.expires_in,
    };
  }

  // --- OData helpers --------------------------------------------------------

  private async odataGet(access: CrmAccess, path: string): Promise<any> {
    const base = access.instanceUrl;
    if (!base) throw new Error("Dynamics connection has no org URL");
    const response = await fetch(`${base}${API_PATH}${path}`, {
      headers: {
        Authorization: `Bearer ${access.token}`,
        Accept: "application/json",
        "OData-MaxVersion": "4.0",
        "OData-Version": "4.0",
        // Formatted values → leesbare optionset-labels (bijv. dealfase).
        Prefer: 'odata.include-annotations="OData.Community.Display.V1.FormattedValue"',
      },
    });
    if (response.status === 404) return null;
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Dynamics GET ${path} failed: ${response.status} ${text}`);
    }
    return response.json();
  }

  private static fv(record: any, field: string): string | null {
    return (
      record?.[`${field}@OData.Community.Display.V1.FormattedValue`] ?? null
    );
  }

  protected async fetchCrmContextByEmail(
    access: CrmAccess,
    email: string
  ): Promise<CrmContext | null> {
    const safeEmail = email.toLowerCase().replace(/'/g, "''");

    // 1) Contact op e-mailadres
    const contactRes = await this.odataGet(
      access,
      `/contacts?$select=contactid,firstname,lastname,jobtitle,_parentcustomerid_value&$filter=emailaddress1 eq '${safeEmail}'&$top=1`
    );
    const contact = contactRes?.value?.[0];
    if (!contact) return null;

    const context: CrmContext = {
      contact: {
        id: contact.contactid,
        firstName: contact.firstname ?? null,
        lastName: contact.lastname ?? null,
        jobTitle: contact.jobtitle ?? null,
      },
      company: null,
      deal: null,
      otherOpenDealCount: 0,
      recentNotes: [],
    };

    // 2) Account (parentcustomer wanneer dat een account is)
    const accountId: string | null = contact._parentcustomerid_value ?? null;
    if (accountId) {
      const account = await this.odataGet(
        access,
        `/accounts(${accountId})?$select=name,websiteurl`
      );
      if (account) {
        context.company = {
          id: accountId,
          name: account.name ?? null,
          domain: account.websiteurl ?? null,
        };
      }
    }

    // 3) Open opportunities via contact ÉN account (statecode 0 = open)
    const orClauses = [`_parentcontactid_value eq ${contact.contactid}`];
    if (accountId) orClauses.push(`_parentaccountid_value eq ${accountId}`);
    const oppRes = await this.odataGet(
      access,
      `/opportunities?$select=opportunityid,name,estimatedvalue,estimatedclosedate,stepname,modifiedon,statecode&$filter=(${orClauses.join(
        " or "
      )}) and statecode eq 0&$orderby=modifiedon desc`
    );
    const openDeals = oppRes?.value ?? [];
    if (openDeals.length > 0) {
      const top = openDeals[0];
      context.deal = {
        id: top.opportunityid,
        name: top.name ?? "(naamloze deal)",
        stageLabel:
          top.stepname ?? DynamicsProvider.fv(top, "statecode") ?? "onbekend",
        pipelineLabel: "",
        amount:
          DynamicsProvider.fv(top, "estimatedvalue") ??
          (top.estimatedvalue != null ? String(top.estimatedvalue) : null),
        closeDate: top.estimatedclosedate ?? null,
        lastModified: top.modifiedon ?? "",
      };
      context.otherOpenDealCount = openDeals.length - 1;
    }

    // 4) Recente notities (annotations) bij de deal of anders het contact
    try {
      const parentId = context.deal?.id ?? contact.contactid;
      const noteRes = await this.odataGet(
        access,
        `/annotations?$select=subject,notetext,createdon&$filter=_objectid_value eq ${parentId}&$orderby=createdon desc&$top=3`
      );
      context.recentNotes = (noteRes?.value ?? [])
        .map((n: any) => ({
          createdAt: n.createdon ?? "",
          preview: [n.subject, n.notetext]
            .filter(Boolean)
            .join(": ")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 300),
        }))
        .filter((n: any) => n.preview.length > 0);
    } catch (error) {
      console.warn("[Dynamics] Notes lookup failed (non-fatal):", error);
    }

    return context;
  }

  protected async fetchDealContactEmails(
    access: CrmAccess,
    dealId: string
  ): Promise<string[]> {
    const emails = new Set<string>();

    // Primaire contactpersoon van de opportunity
    const opp = await this.odataGet(
      access,
      `/opportunities(${dealId})?$select=_parentcontactid_value,_parentaccountid_value`
    );
    const primaryContactId = opp?._parentcontactid_value ?? null;
    if (primaryContactId) {
      const c = await this.odataGet(
        access,
        `/contacts(${primaryContactId})?$select=emailaddress1`
      );
      if (c?.emailaddress1) emails.add(String(c.emailaddress1).toLowerCase());
    }

    // Overige contacten van het account
    const accountId = opp?._parentaccountid_value ?? null;
    if (accountId) {
      const contacts = await this.odataGet(
        access,
        `/contacts?$select=emailaddress1&$filter=_parentcustomerid_value eq ${accountId}&$top=100`
      );
      for (const c of contacts?.value ?? []) {
        if (c.emailaddress1) emails.add(String(c.emailaddress1).toLowerCase());
      }
    }

    return [...emails].filter((e) => e.includes("@"));
  }
}
