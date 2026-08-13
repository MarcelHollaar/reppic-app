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

// Salesforce-koppeling per tenant. OAuth 2.0 web-server-flow; per-org
// instance_url wordt bij de token-exchange teruggegeven en is de API-basis.
// Read-only via SOQL: Contact → Account → open Opportunity (IsClosed = false)
// → Notes. Salesforce geeft geen expires_in bij (re)fresh; we hanteren een
// conservatief refresh-venster.

const SF_SCOPES = ["api", "refresh_token"];
// Sessieduur is per-org instelbaar (default ~2u); we verversen ruim daarvoor.
const SF_SYNTHETIC_TTL_S = 90 * 60;

export class SalesforceProvider extends BaseCrmProvider {
  readonly id: CrmProviderId = "salesforce";
  readonly label = "Salesforce";

  private config():
    | {
        clientId: string;
        clientSecret: string;
        redirectUri: string;
        loginUrl: string;
        apiVersion: string;
      }
    | null {
    const clientId = process.env.SALESFORCE_CLIENT_ID;
    const clientSecret = process.env.SALESFORCE_CLIENT_SECRET;
    const redirectUri = process.env.SALESFORCE_REDIRECT_URI;
    if (!clientId || !clientSecret || !redirectUri) return null;
    return {
      clientId,
      clientSecret,
      redirectUri,
      // Productie: login.salesforce.com; sandbox: test.salesforce.com.
      loginUrl:
        process.env.SALESFORCE_LOGIN_URL || "https://login.salesforce.com",
      apiVersion: process.env.SALESFORCE_API_VERSION || "v60.0",
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

  buildAuthorizeUrl(state: string): string {
    const { clientId, redirectUri, loginUrl } = this.requireConfig();
    const url = new URL(`${loginUrl}/services/oauth2/authorize`);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", SF_SCOPES.join(" "));
    url.searchParams.set("state", state);
    return url.toString();
  }

  private async tokenRequest(
    params: Record<string, string>
  ): Promise<{
    access_token: string;
    refresh_token?: string;
    instance_url: string;
    id: string;
  }> {
    const { loginUrl } = this.requireConfig();
    const response = await fetch(`${loginUrl}/services/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(params).toString(),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Salesforce token request failed: ${response.status} ${text}`
      );
    }
    return response.json();
  }

  protected async exchangeAuthCode(code: string): Promise<ConnectionResult> {
    const { clientId, clientSecret, redirectUri } = this.requireConfig();
    const res = await this.tokenRequest({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code,
    });
    // Org-id staat in de identity-URL: .../id/{orgId}/{userId}
    const orgId = res.id.split("/id/")[1]?.split("/")[0] ?? "";
    return {
      tokens: {
        access_token: res.access_token,
        refresh_token: res.refresh_token ?? "",
        expires_in: SF_SYNTHETIC_TTL_S,
      },
      externalAccountId: orgId,
      instanceUrl: res.instance_url,
      scopes: SF_SCOPES.join(" "),
    };
  }

  protected async refreshTokens(
    conn: CrmConnectionRow
  ): Promise<OAuthTokens> {
    const { clientId, clientSecret } = this.requireConfig();
    const res = await this.tokenRequest({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: decryptSecret(conn.refresh_token_enc),
    });
    return {
      access_token: res.access_token,
      // Refresh-response bevat doorgaans geen nieuw refresh-token: hergebruik.
      refresh_token: res.refresh_token ?? decryptSecret(conn.refresh_token_enc),
      expires_in: SF_SYNTHETIC_TTL_S,
    };
  }

  // --- SOQL helpers ---------------------------------------------------------

  private static escape(value: string): string {
    // SOQL string-literal escaping (quotes + backslashes).
    return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  }

  private async soql(access: CrmAccess, query: string): Promise<any> {
    const { apiVersion } = this.requireConfig();
    const base = access.instanceUrl;
    if (!base) throw new Error("Salesforce connection has no instance_url");
    const url = `${base}/services/data/${apiVersion}/query?q=${encodeURIComponent(
      query
    )}`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${access.token}` },
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Salesforce SOQL failed: ${response.status} ${text}`);
    }
    return response.json();
  }

  protected async fetchCrmContextByEmail(
    access: CrmAccess,
    email: string
  ): Promise<CrmContext | null> {
    const safeEmail = SalesforceProvider.escape(email.toLowerCase());

    // 1) Contact op e-mailadres
    const contactRes = await this.soql(
      access,
      `SELECT Id, FirstName, LastName, Title, AccountId FROM Contact WHERE Email = '${safeEmail}' LIMIT 1`
    );
    const contact = contactRes?.records?.[0];
    if (!contact) return null;

    const context: CrmContext = {
      contact: {
        id: contact.Id,
        firstName: contact.FirstName ?? null,
        lastName: contact.LastName ?? null,
        jobTitle: contact.Title ?? null,
      },
      company: null,
      deal: null,
      otherOpenDealCount: 0,
      recentNotes: [],
    };

    // 2) Account
    const accountId: string | null = contact.AccountId ?? null;
    if (accountId) {
      const accRes = await this.soql(
        access,
        `SELECT Id, Name, Website FROM Account WHERE Id = '${SalesforceProvider.escape(
          accountId
        )}' LIMIT 1`
      );
      const account = accRes?.records?.[0];
      if (account) {
        context.company = {
          id: account.Id,
          name: account.Name ?? null,
          domain: account.Website ?? null,
        };
      }
    }

    // 3) Open opportunities: via contactrol ÉN via account (samengevoegd).
    const oppIds = new Set<string>();
    const roleRes = await this.soql(
      access,
      `SELECT OpportunityId FROM OpportunityContactRole WHERE ContactId = '${SalesforceProvider.escape(
        contact.Id
      )}'`
    );
    for (const r of roleRes?.records ?? []) {
      if (r.OpportunityId) oppIds.add(r.OpportunityId);
    }
    if (accountId) {
      const accOpps = await this.soql(
        access,
        `SELECT Id FROM Opportunity WHERE AccountId = '${SalesforceProvider.escape(
          accountId
        )}' AND IsClosed = false`
      );
      for (const r of accOpps?.records ?? []) {
        if (r.Id) oppIds.add(r.Id);
      }
    }

    if (oppIds.size > 0) {
      const idList = [...oppIds]
        .map((id) => `'${SalesforceProvider.escape(id)}'`)
        .join(",");
      const oppRes = await this.soql(
        access,
        `SELECT Id, Name, StageName, Amount, CloseDate, LastModifiedDate FROM Opportunity WHERE Id IN (${idList}) AND IsClosed = false ORDER BY LastModifiedDate DESC`
      );
      const openDeals = oppRes?.records ?? [];
      if (openDeals.length > 0) {
        const top = openDeals[0];
        context.deal = {
          id: top.Id,
          name: top.Name ?? "(naamloze deal)",
          stageLabel: top.StageName ?? "onbekend",
          pipelineLabel: "",
          amount: top.Amount != null ? String(top.Amount) : null,
          closeDate: top.CloseDate ?? null,
          lastModified: top.LastModifiedDate ?? "",
        };
        context.otherOpenDealCount = openDeals.length - 1;
      }
    }

    // 4) Recente notities (legacy Note-object) bij de deal of anders het contact.
    try {
      const parentId = context.deal?.id ?? contact.Id;
      const noteRes = await this.soql(
        access,
        `SELECT Title, Body, CreatedDate FROM Note WHERE ParentId = '${SalesforceProvider.escape(
          parentId
        )}' ORDER BY CreatedDate DESC LIMIT 3`
      );
      context.recentNotes = (noteRes?.records ?? [])
        .map((n: any) => ({
          createdAt: n.CreatedDate ?? "",
          preview: [n.Title, n.Body]
            .filter(Boolean)
            .join(": ")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 300),
        }))
        .filter((n: any) => n.preview.length > 0);
    } catch (error) {
      console.warn("[Salesforce] Notes lookup failed (non-fatal):", error);
    }

    return context;
  }

  protected async fetchDealContactEmails(
    access: CrmAccess,
    dealId: string
  ): Promise<string[]> {
    const res = await this.soql(
      access,
      `SELECT Contact.Email FROM OpportunityContactRole WHERE OpportunityId = '${SalesforceProvider.escape(
        dealId
      )}'`
    );
    const emails = (res?.records ?? [])
      .map((r: any) => String(r.Contact?.Email ?? "").toLowerCase().trim())
      .filter((e: string) => e.includes("@"));
    return [...new Set(emails)] as string[];
  }
}
