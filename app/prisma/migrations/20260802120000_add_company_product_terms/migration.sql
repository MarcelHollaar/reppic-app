-- Bedrijfsspecifieke productnamen voor transcriptie-keyterms (AssemblyAI keyterms_prompt)
ALTER TABLE "company_terminology" ADD COLUMN "product_terms" JSONB NOT NULL DEFAULT '[]';
