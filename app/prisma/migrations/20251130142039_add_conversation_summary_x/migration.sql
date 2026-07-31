-- CreateTable
CREATE TABLE "conversation_summaries_x" (
    "id" VARCHAR(40) NOT NULL,
    "conversation_id" VARCHAR(40) NOT NULL,
    "transcribed_text" TEXT,
    "learning_points" TEXT[],
    "mail_text" TEXT,
    "summary_text" TEXT,
    "resistance_text" TEXT,
    "salesperson_percentage" INTEGER,
    "atmosphere" VARCHAR(50),
    "total_score" INTEGER,
    "phases" JSONB,
    "resistances" JSONB,
    "customer_type" VARCHAR(50),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversation_summaries_x_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "conversation_summaries_x" ADD CONSTRAINT "conversation_summaries_x_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "user_conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
