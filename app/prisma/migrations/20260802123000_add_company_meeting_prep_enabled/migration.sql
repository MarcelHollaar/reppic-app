-- Gespreksvoorbereiding (fase 4): feature-vlag per tenant voor de
-- automatische prep-mails (gefaseerde rollout, default uit).

ALTER TABLE "companies" ADD COLUMN "meeting_prep_enabled" BOOLEAN NOT NULL DEFAULT false;
