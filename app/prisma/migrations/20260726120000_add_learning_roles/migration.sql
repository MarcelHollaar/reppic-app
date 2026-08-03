-- LMS-integratie Fase 1: leer-as naast de sales-as.
-- Zie LMS-INTEGRATIE-PLAN-DEFINITIEF-2026-07-26.md.

-- CreateEnum
CREATE TYPE "LearningRole" AS ENUM ('none', 'learner', 'learning_admin');

-- AlterTable: elke bestaande gebruiker wordt standaard learner (B1-default)
ALTER TABLE "users" ADD COLUMN "learning_role" "LearningRole" NOT NULL DEFAULT 'learner';

-- AlterTable: knop per bedrijf (volledig LMS) + Kennisbibliotheek-add-on (B5)
ALTER TABLE "companies" ADD COLUMN "lms_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "companies" ADD COLUMN "has_knowledge_access" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: bedrijfscontact-managers (manager wiens e-mail = bedrijfs-e-mail,
-- dezelfde afleiding als is_company_contact_manager in authServices) worden learning_admin.
UPDATE "users" u
SET "learning_role" = 'learning_admin'
FROM "companies" c, "roles" r
WHERE u."company_id" = c."id"
  AND u."role_id" = r."id"
  AND r."name" = 'manager'
  AND u."email" = c."email";
