-- Non-sales conversations must not count in any assessment.
ALTER TABLE "conversation_summaries_x"
  ADD COLUMN "geen_salesgesprek" BOOLEAN NOT NULL DEFAULT false;
