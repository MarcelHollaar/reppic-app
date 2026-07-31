-- CreateTable
CREATE TABLE "transcript_analysis_prompt_versions" (
    "id" VARCHAR(40) NOT NULL,
    "version" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "note" VARCHAR(500),
    "created_by" VARCHAR(40),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transcript_analysis_prompt_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "transcript_analysis_prompt_version_unique" ON "transcript_analysis_prompt_versions"("version");

-- CreateIndex
CREATE INDEX "idx_transcript_analysis_prompt_active" ON "transcript_analysis_prompt_versions"("is_active");
