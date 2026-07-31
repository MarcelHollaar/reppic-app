/*
  Warnings:

  - You are about to drop the column `video_id` on the `tags` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "tags" DROP CONSTRAINT "tags_video_id_fkey";

-- AlterTable
ALTER TABLE "tags" DROP COLUMN "video_id";

-- AlterTable
ALTER TABLE "videos" ALTER COLUMN "embeded_code" SET DEFAULT '',
ALTER COLUMN "number" SET DEFAULT 0,
ALTER COLUMN "phase" SET DEFAULT 'phase1',
ALTER COLUMN "type" SET DEFAULT 'General';

-- CreateTable
CREATE TABLE "video_tags" (
    "id" VARCHAR(40) NOT NULL,
    "video_id" VARCHAR(40) NOT NULL,
    "tag_id" VARCHAR(40) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "video_tags_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "videos" DROP COLUMN "embeded_code",
DROP COLUMN "path",
ADD COLUMN     "embedded_code" TEXT NOT NULL DEFAULT '',
ALTER COLUMN "length" DROP NOT NULL;

-- AlterTable
ALTER TABLE "categories" ALTER COLUMN "status" SET DEFAULT 'active';

-- AlterTable
ALTER TABLE "tags" ALTER COLUMN "status" SET DEFAULT 'active';

-- AlterTable
ALTER TABLE "videos" DROP COLUMN "phase",
ADD COLUMN     "phase" INTEGER NOT NULL DEFAULT 1;

-- DropEnum
DROP TYPE "VideoPhase";


-- CreateIndex
CREATE UNIQUE INDEX "video_tags_video_id_tag_id_key" ON "video_tags"("video_id", "tag_id");

-- AddForeignKey
ALTER TABLE "video_tags" ADD CONSTRAINT "video_tags_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_tags" ADD CONSTRAINT "video_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
