// Provider-neutrale types voor de CRM-koppeling van de gespreksvoorbereiding.
// Elke provider (HubSpot, Salesforce, Dynamics) levert dezelfde CrmContext op,
// zodat de prep-flow niet weet wélke CRM erachter zit.

export type CrmProviderId = "hubspot" | "salesforce" | "dynamics";

export const CRM_PROVIDER_IDS: CrmProviderId[] = [
  "hubspot",
  "salesforce",
  "dynamics",
];

export interface CrmDealSummary {
  id: string;
  name: string;
  stageLabel: string;
  pipelineLabel: string;
  amount: string | null;
  closeDate: string | null;
  lastModified: string;
}

export interface CrmContext {
  contact: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    jobTitle: string | null;
  } | null;
  company: { id: string; name: string | null; domain: string | null } | null;
  deal: CrmDealSummary | null;
  otherOpenDealCount: number;
  recentNotes: Array<{ createdAt: string; preview: string }>;
}

// OAuth-tokenset zoals elke provider die na code-exchange/refresh teruggeeft.
export interface OAuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

// Resultaat van de code-exchange: tokens + de identiteit/basis die we opslaan.
export interface ConnectionResult {
  tokens: OAuthTokens;
  externalAccountId: string;
  instanceUrl: string | null;
  scopes: string;
}

// Geldige toegang voor één API-call: token + (voor SF/Dynamics) de API-basis.
export interface CrmAccess {
  token: string;
  instanceUrl: string | null;
}

// De ruwe connectie-rij zoals de base 'm onder een row-lock ophaalt.
export interface CrmConnectionRow {
  id: string;
  provider: string;
  external_account_id: string;
  instance_url: string | null;
  access_token_enc: string;
  refresh_token_enc: string;
  expires_at: Date;
  status: string;
}

export interface CrmConnectionStatus {
  connected: boolean;
  provider?: CrmProviderId;
  externalAccountId?: string;
  status?: string;
  connectedAt?: Date;
}

// Gedeelde interface waar de prep-flow en de routes tegenaan praten.
export interface ICrmProvider {
  readonly id: CrmProviderId;
  /** Merknaam voor UI + het CRM-contextblok in de prompt. */
  readonly label: string;
  /** True zodra de OAuth-app-credentials in de omgeving staan. */
  isConfigured(): boolean;

  buildAuthorizeUrl(state: string, params?: Record<string, string>): string;
  completeConnection(
    companyId: string,
    code: string,
    connectedBy: string,
    params?: Record<string, string>
  ): Promise<{ externalAccountId: string }>;
  getConnectionStatus(companyId: string): Promise<CrmConnectionStatus>;
  disconnect(companyId: string): Promise<void>;

  findCrmContextByEmail(
    companyId: string,
    email: string
  ): Promise<CrmContext | null>;
  getDealContactEmails(companyId: string, dealId: string): Promise<string[]>;
  buildCrmContextBlock(context: CrmContext): string;
}

/** Provider is (nog) niet geconfigureerd → route geeft 501 "nog niet beschikbaar". */
export class CrmProviderNotConfiguredError extends Error {
  constructor(providerId: string) {
    super(`CRM provider "${providerId}" is not configured`);
    this.name = "CrmProviderNotConfiguredError";
  }
}
