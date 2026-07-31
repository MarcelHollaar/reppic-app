-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "user_id" VARCHAR(40);

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
