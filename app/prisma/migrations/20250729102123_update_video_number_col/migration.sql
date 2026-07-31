-- AlterTable
ALTER TABLE "videos" ALTER COLUMN "number" DROP DEFAULT,
ALTER COLUMN "number" SET DATA TYPE VARCHAR(40);

-- AlterTable
ALTER TABLE "title_translations" ADD COLUMN     "embedded_code" TEXT NOT NULL DEFAULT '';