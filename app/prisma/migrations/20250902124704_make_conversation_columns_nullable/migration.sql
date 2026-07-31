/*
  Warnings:

  - A unique constraint covering the columns `[name]` on the table `roles` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "user_conversations" DROP CONSTRAINT "user_conversations_customer_id_fkey";

-- AlterTable
ALTER TABLE "user_conversations" ADD COLUMN     "conversation_status" VARCHAR(50),
ADD COLUMN     "from_device_id" VARCHAR(255),
ALTER COLUMN "customer_id" DROP NOT NULL,
ALTER COLUMN "title" DROP NOT NULL,
ALTER COLUMN "file_path" DROP NOT NULL,
ALTER COLUMN "meeting_date" DROP NOT NULL,
ALTER COLUMN "meeting_time_start" DROP NOT NULL,
ALTER COLUMN "meeting_time_end" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- AddForeignKey
ALTER TABLE "user_conversations" ADD CONSTRAINT "user_conversations_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
