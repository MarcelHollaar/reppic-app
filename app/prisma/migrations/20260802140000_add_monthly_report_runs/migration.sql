-- Idempotentie voor het maandelijkse manager-rapport
CREATE TABLE "monthly_report_runs" (
    "id" VARCHAR(40) NOT NULL,
    "company_id" VARCHAR(40) NOT NULL,
    "period" VARCHAR(7) NOT NULL,
    "recipients_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "monthly_report_runs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "monthly_report_runs_company_id_period_key" ON "monthly_report_runs"("company_id", "period");
