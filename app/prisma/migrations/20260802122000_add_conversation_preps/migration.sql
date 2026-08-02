-- Gespreksvoorbereiding (fase 3): prep-administratie per agenda-afspraak
-- + admin-bewerkbare prep-prompt (zelfde patroon als transcript-analyse).

CREATE TABLE "conversation_preps" (
    "id" VARCHAR(40) NOT NULL,
    "company_id" VARCHAR(40) NOT NULL,
    "user_id" VARCHAR(40) NOT NULL,
    "prospect_account_id" VARCHAR(40),
    "calendar_event_id" VARCHAR(255) NOT NULL,
    "meeting_title" VARCHAR(255),
    "meeting_start" TIMESTAMP(3) NOT NULL,
    "source_conversation_ids" JSONB NOT NULL,
    "hubspot_deal_id" VARCHAR(64),
    "content" JSONB,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "skip_reason" VARCHAR(100),
    "fail_count" INTEGER NOT NULL DEFAULT 0,
    "email_sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversation_preps_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "conversation_preps_calendar_event_id_key" ON "conversation_preps"("calendar_event_id");
CREATE INDEX "idx_conversation_preps_company" ON "conversation_preps"("company_id");
CREATE INDEX "idx_conversation_preps_meeting_start" ON "conversation_preps"("meeting_start");

ALTER TABLE "conversation_preps" ADD CONSTRAINT "conversation_preps_prospect_account_id_fkey" FOREIGN KEY ("prospect_account_id") REFERENCES "prospect_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "prep_analysis_prompt_versions" (
    "id" VARCHAR(40) NOT NULL,
    "version" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "note" VARCHAR(500),
    "created_by" VARCHAR(40),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prep_analysis_prompt_versions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "prep_analysis_prompt_versions_version_key" ON "prep_analysis_prompt_versions"("version");
CREATE INDEX "idx_prep_analysis_prompt_active" ON "prep_analysis_prompt_versions"("is_active");
