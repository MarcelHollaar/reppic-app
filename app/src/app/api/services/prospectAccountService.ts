import { prisma } from "../utils/prisma";
import {
  deriveProspectDisplayName,
  deriveProspectKey,
  extractExternalAttendees,
} from "@/lib/prospect/resolveProspect";

// Gespreksvoorbereiding: herleidt de eindklant (prospect) uit de deelnemers
// van een agenda-afspraak en beheert de blijvende ProspectAccount-entiteit
// per tenant (Company). Zie src/lib/prospect/resolveProspect.ts voor de
// pure matching-regels.

export interface ResolvedProspect {
  prospectAccountId: string;
  domain: string;
  externalAttendees: string[];
}

export class ProspectAccountService {
  /**
   * Bepaalt de externe deelnemers en koppelt (of maakt) de bijbehorende
   * ProspectAccount voor de tenant. Geeft null terug wanneer er geen
   * externe deelnemers zijn (bijv. intern overleg) of de verkoper geen
   * company heeft.
   */
  static async resolveAndUpsertProspect(
    companyId: string | null | undefined,
    attendeeEmails: Array<string | null | undefined>,
    organizerEmail: string
  ): Promise<ResolvedProspect | null> {
    if (!companyId) return null;

    const externalAttendees = extractExternalAttendees(
      attendeeEmails,
      organizerEmail
    );
    if (externalAttendees.length === 0) return null;

    // Eerste externe deelnemer bepaalt de prospect-sleutel; overige
    // deelnemers reizen mee in attendee_emails op het gesprek.
    const key = deriveProspectKey(externalAttendees[0]);
    if (!key) return null;

    const account = await prisma.prospectAccount.upsert({
      where: {
        prospect_account_company_domain_unique: {
          company_id: companyId,
          domain: key.domain,
        },
      },
      update: {},
      create: {
        company_id: companyId,
        domain: key.domain,
        name: deriveProspectDisplayName(key),
      },
    });

    return {
      prospectAccountId: account.id,
      domain: account.domain,
      externalAttendees,
    };
  }

  /**
   * Eerdere gesprekken van dezelfde prospect (nieuwste eerst), inclusief de
   * actieve analyse (ConversationSummaryX). Bron voor de prep-analyse.
   */
  static async findConversationsForProspect(
    prospectAccountId: string,
    limit: number = 5
  ) {
    return prisma.userConversation.findMany({
      where: { prospect_account_id: prospectAccountId },
      orderBy: { created_at: "desc" },
      take: limit,
      include: {
        conversation_summaries_x: {
          orderBy: { created_at: "desc" },
          take: 1,
        },
      },
    });
  }
}
