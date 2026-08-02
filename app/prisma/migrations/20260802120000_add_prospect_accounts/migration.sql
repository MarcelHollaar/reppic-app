-- Gespreksvoorbereiding (fase 1): blijvende eindklant-entiteit + deelnemers
-- op het gesprek. Zie src/lib/prospect/resolveProspect.ts voor de
-- domein/freemail-sleutelregel.

CREATE TABLE "prospect_accounts" (
    "id" VARCHAR(40) NOT NULL,
    "company_id" VARCHAR(40) NOT NULL,
    "domain" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255),
    "hubspot_company_id" VARCHAR(64),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prospect_accounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "prospect_accounts_company_id_domain_key" ON "prospect_accounts"("company_id", "domain");

ALTER TABLE "prospect_accounts" ADD CONSTRAINT "prospect_accounts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "user_conversations" ADD COLUMN "attendee_emails" JSONB;
ALTER TABLE "user_conversations" ADD COLUMN "calendar_event_id" VARCHAR(255);
ALTER TABLE "user_conversations" ADD COLUMN "prospect_account_id" VARCHAR(40);

CREATE INDEX "idx_user_conversations_prospect" ON "user_conversations"("prospect_account_id");

ALTER TABLE "user_conversations" ADD CONSTRAINT "user_conversations_prospect_account_id_fkey" FOREIGN KEY ("prospect_account_id") REFERENCES "prospect_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
