-- CreateTable
CREATE TABLE "prompts" (
    "id" VARCHAR(40) NOT NULL,
    "lang_code" VARCHAR(10) NOT NULL,
    "prompt" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prompts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_prompt_lang" ON "prompts"("lang_code");
