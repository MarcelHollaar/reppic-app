/*
  Warnings:

  - You are about to drop the column `question_asked` on the `conversation_summaries` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "conversation_summaries" DROP COLUMN "question_asked",
ADD COLUMN     "questions_asked" INTEGER NOT NULL DEFAULT 0;
