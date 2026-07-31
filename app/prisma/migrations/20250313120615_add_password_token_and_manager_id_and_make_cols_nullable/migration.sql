/*
  Warnings:

  - A unique constraint covering the columns `[password_token]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "users" ADD COLUMN     "manager_id" VARCHAR(40),
ADD COLUMN     "password_token" VARCHAR(255),
ALTER COLUMN "password" DROP NOT NULL,
ALTER COLUMN "phone_number" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "users_password_token_key" ON "users"("password_token");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
