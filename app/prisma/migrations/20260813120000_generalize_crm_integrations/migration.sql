-- Generaliseer de HubSpot-koppeling naar een provider-neutrale CRM-koppeling
-- (hubspot | salesforce | dynamics). Bestaande HubSpot-rijen blijven behouden:
-- we hernoemen de tabel/kolommen in plaats van te droppen + herseeden.

-- 1) hubspot_connections -> crm_connections (+ provider, instance_url)
ALTER TABLE "hubspot_connections" RENAME TO "crm_connections";
ALTER TABLE "crm_connections" RENAME COLUMN "portal_id" TO "external_account_id";
ALTER TABLE "crm_connections" ALTER COLUMN "external_account_id" TYPE VARCHAR(64);
ALTER TABLE "crm_connections" ADD COLUMN "provider" VARCHAR(20) NOT NULL DEFAULT 'hubspot';
ALTER TABLE "crm_connections" ADD COLUMN "instance_url" TEXT;
-- Default was alleen nodig om bestaande rijen te backfillen; nieuwe rijen
-- zetten provider expliciet.
ALTER TABLE "crm_connections" ALTER COLUMN "provider" DROP DEFAULT;

-- Index/constraint-namen meeverhuizen zodat toekomstige prisma-diffs schoon zijn.
ALTER INDEX "hubspot_connections_pkey" RENAME TO "crm_connections_pkey";
ALTER INDEX "hubspot_connections_company_id_key" RENAME TO "crm_connections_company_id_key";

-- 2) Neutrale externe-id-velden op de prep-entiteiten.
ALTER TABLE "prospect_accounts" RENAME COLUMN "hubspot_company_id" TO "crm_company_id";
ALTER TABLE "conversation_preps" RENAME COLUMN "hubspot_deal_id" TO "crm_deal_id";
