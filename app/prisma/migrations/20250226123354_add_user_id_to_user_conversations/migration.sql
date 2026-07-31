/*
  Warnings:

  - Added the required column `user_id` to the `user_conversations` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "user_conversations" ADD COLUMN     "user_id" VARCHAR(40) NOT NULL;

-- AddForeignKey
ALTER TABLE "user_conversations" ADD CONSTRAINT "user_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
