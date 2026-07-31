/*
  Warnings:

  - Added the required column `customer_type` to the `conversation_summaries` table without a default value. This is not possible if the table is not empty.
  - Added the required column `phases` to the `conversation_summaries` table without a default value. This is not possible if the table is not empty.
  - Added the required column `title` to the `conversation_summaries` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "conversation_summaries" ADD COLUMN     "customer_type" VARCHAR(50) NOT NULL,
ADD COLUMN     "phases" JSONB NOT NULL,
ADD COLUMN     "title" TEXT NOT NULL;
