import { prisma } from "../../utils/prisma";
import { HubspotProvider } from "./hubspotProvider";
import { SalesforceProvider } from "./salesforceProvider";
import { DynamicsProvider } from "./dynamicsProvider";
import type {
  CrmConnectionStatus,
  CrmProviderId,
  ICrmProvider,
} from "./types";
import { CRM_PROVIDER_IDS } from "./types";

// Eén instantie per provider (stateless op de pipeline-cache na, die per
// instantie mag leven). De prep-flow en de routes praten alleen hiertegen.
const PROVIDERS: Record<CrmProviderId, ICrmProvider> = {
  hubspot: new HubspotProvider(),
  salesforce: new SalesforceProvider(),
  dynamics: new DynamicsProvider(),
};

export function isCrmProviderId(value: string): value is CrmProviderId {
  return (CRM_PROVIDER_IDS as string[]).includes(value);
}

export function getCrmProvider(id: CrmProviderId): ICrmProvider {
  return PROVIDERS[id];
}

/** Alle providers + of ze geconfigureerd zijn (voor de UI-knoppen). */
export function listCrmProviders(): Array<{
  id: CrmProviderId;
  label: string;
  configured: boolean;
}> {
  return CRM_PROVIDER_IDS.map((id) => {
    const p = PROVIDERS[id];
    return { id, label: p.label, configured: p.isConfigured() };
  });
}

/** Ontkoppel de CRM-koppeling van een bedrijf (ongeacht provider/status). */
export async function disconnectCrm(companyId: string): Promise<void> {
  await prisma.crmConnection.deleteMany({ where: { company_id: companyId } });
}

/** Verbindingsstatus van de (enige) CRM-koppeling van een bedrijf. */
export async function getCrmConnectionStatus(
  companyId: string
): Promise<CrmConnectionStatus> {
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
    provider: isCrmProviderId(conn.provider) ? conn.provider : undefined,
    externalAccountId: conn.external_account_id,
    status: conn.status,
    connectedAt: conn.created_at,
  };
}

/**
 * De actieve CRM-provider voor een bedrijf (op basis van de opgeslagen
 * connectie), of null als er geen CRM gekoppeld is. Hiermee weet de prep-flow
 * welke provider te gebruiken zonder de CRM-soort te kennen.
 */
export async function getActiveCrmProvider(
  companyId: string
): Promise<ICrmProvider | null> {
  const conn = await prisma.crmConnection.findUnique({
    where: { company_id: companyId },
    select: { provider: true, status: true },
  });
  if (!conn || conn.status !== "active") return null;
  if (!isCrmProviderId(conn.provider)) return null;
  return PROVIDERS[conn.provider];
}
