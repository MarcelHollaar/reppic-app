import { prisma } from "../../utils/prisma";
import { decryptSecret, encryptSecret } from "@/lib/crypto/secretBox";
import type {
  ConnectionResult,
  CrmAccess,
  CrmConnectionRow,
  CrmConnectionStatus,
  CrmContext,
  CrmProviderId,
  ICrmProvider,
  OAuthTokens,
} from "./types";

const REFRESH_MARGIN_MS = 120_000; // refresh als token binnen 2 min verloopt

/**
 * Gedeelde basis voor alle CRM-providers. Handelt de tenant-opslag af:
 * encrypted tokens in `crm_connections` (één actieve CRM per bedrijf),
 * token-refresh onder een Postgres row-lock (SELECT ... FOR UPDATE zodat
 * parallelle callers niet dubbel refreshen), en het NL-contextblok voor de
 * prompt. Subklassen leveren alleen het provider-specifieke deel: OAuth-URL,
 * code-exchange, token-refresh en het ophalen van de CRM-context.
 */
export abstract class BaseCrmProvider implements ICrmProvider {
  abstract readonly id: CrmProviderId;
  abstract readonly label: string;
  abstract isConfigured(): boolean;
  abstract buildAuthorizeUrl(
    state: string,
    params?: Record<string, string>
  ): string;

  // --- Door subklassen te implementeren provider-specifieke stukken ---------

  /** Wissel de authorization code in voor tokens + identiteit/basis. */
  protected abstract exchangeAuthCode(
    code: string,
    params?: Record<string, string>
  ): Promise<ConnectionResult>;

  /** Ververs de tokens; krijgt de volledige rij (voor instance_url/tenant). */
  protected abstract refreshTokens(conn: CrmConnectionRow): Promise<OAuthTokens>;

  /** Haal de CRM-context op met een geldige toegang (token + basis-URL). */
  protected abstract fetchCrmContextByEmail(
    access: CrmAccess,
    email: string
  ): Promise<CrmContext | null>;

  /** E-mailadressen van de contacten aan een deal (per-deal scoping). */
  protected abstract fetchDealContactEmails(
    access: CrmAccess,
    dealId: string
  ): Promise<string[]>;

  // --- Gedeelde, concrete implementatie -------------------------------------

  async completeConnection(
    companyId: string,
    code: string,
    connectedBy: string,
    params?: Record<string, string>
  ): Promise<{ externalAccountId: string }> {
    const result = await this.exchangeAuthCode(code, params);
    const data = {
      provider: this.id,
      external_account_id: result.externalAccountId,
      instance_url: result.instanceUrl,
      access_token_enc: encryptSecret(result.tokens.access_token),
      refresh_token_enc: encryptSecret(result.tokens.refresh_token),
      expires_at: new Date(Date.now() + result.tokens.expires_in * 1000),
      scopes: result.scopes,
      status: "active",
      connected_by: connectedBy,
    };
    await prisma.crmConnection.upsert({
      where: { company_id: companyId },
      update: data,
      create: { company_id: companyId, ...data },
    });
    return { externalAccountId: result.externalAccountId };
  }

  async getConnectionStatus(companyId: string): Promise<CrmConnectionStatus> {
    const conn = await prisma.crmConnection.findUnique({
      where: { company_id: companyId },
      select: {
        provider: true,
        external_account_id: true,
        status: true,
        created_at: true,
      },
    });
    if (!conn) return { connected: false };
    return {
      connected: true,
      provider: conn.provider as CrmProviderId,
      externalAccountId: conn.external_account_id,
      status: conn.status,
      connectedAt: conn.created_at,
    };
  }

  async disconnect(companyId: string): Promise<void> {
    await prisma.crmConnection.deleteMany({
      where: { company_id: companyId, provider: this.id },
    });
  }

  /**
   * Geldige toegang voor de tenant. Refresht onder een row-lock zodat
   * parallelle callers niet dubbel refreshen. Bij een geweigerde refresh
   * (klant heeft de app ontkoppeld) wordt de connectie op "broken" gezet en
   * is de uitkomst null.
   */
  async getValidAccess(companyId: string): Promise<CrmAccess | null> {
    return prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<CrmConnectionRow[]>`
        SELECT id, provider, external_account_id, instance_url,
               access_token_enc, refresh_token_enc, expires_at, status
        FROM crm_connections
        WHERE company_id = ${companyId} AND provider = ${this.id}
        FOR UPDATE`;
      const conn = rows[0];
      if (!conn || conn.status !== "active") return null;

      if (conn.expires_at.getTime() - Date.now() > REFRESH_MARGIN_MS) {
        return {
          token: decryptSecret(conn.access_token_enc),
          instanceUrl: conn.instance_url,
        };
      }

      try {
        const tokens = await this.refreshTokens(conn);
        await tx.crmConnection.update({
          where: { id: conn.id },
          data: {
            access_token_enc: encryptSecret(tokens.access_token),
            refresh_token_enc: encryptSecret(tokens.refresh_token),
            expires_at: new Date(Date.now() + tokens.expires_in * 1000),
          },
        });
        return { token: tokens.access_token, instanceUrl: conn.instance_url };
      } catch (error) {
        console.error(
          `[CRM:${this.id}] Token refresh failed for company ${companyId} — marking broken:`,
          error
        );
        await tx.crmConnection.update({
          where: { id: conn.id },
          data: { status: "broken" },
        });
        return null;
      }
    });
  }

  async findCrmContextByEmail(
    companyId: string,
    email: string
  ): Promise<CrmContext | null> {
    const access = await this.getValidAccess(companyId);
    if (!access) return null;
    return this.fetchCrmContextByEmail(access, email);
  }

  async getDealContactEmails(
    companyId: string,
    dealId: string
  ): Promise<string[]> {
    try {
      const access = await this.getValidAccess(companyId);
      if (!access) return [];
      return await this.fetchDealContactEmails(access, dealId);
    } catch (error) {
      console.warn(
        `[CRM:${this.id}] Deal contact emails failed (non-fatal):`,
        error
      );
      return [];
    }
  }

  /** Compact Nederlands tekstblok met CRM-context voor in de prep-prompt. */
  buildCrmContextBlock(context: CrmContext): string {
    const lines: string[] = [`## CRM-context (${this.label})`];
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
