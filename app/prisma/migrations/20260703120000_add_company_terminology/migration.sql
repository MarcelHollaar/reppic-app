-- Per-company terminology glossary: maps the 4 PICA phases + 15 evaluation
-- topics to a company's own training jargon. Applied only to the LANGUAGE of
-- the feedback and display labels; the analysis structure stays standard.
CREATE TABLE "company_terminology" (
    "id" VARCHAR(40) NOT NULL,
    "company_id" VARCHAR(40) NOT NULL,
    "mapping" JSONB NOT NULL,
    "source_filename" VARCHAR(255),
    "updated_by" VARCHAR(40),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_terminology_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "company_terminology_company_id_key" ON "company_terminology"("company_id");
