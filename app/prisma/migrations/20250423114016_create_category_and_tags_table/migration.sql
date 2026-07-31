/*
  Warnings:

  - Added the required column `embeded_code` to the `videos` table without a default value. This is not possible if the table is not empty.
  - Added the required column `number` to the `videos` table without a default value. This is not possible if the table is not empty.
  - Added the required column `phase` to the `videos` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `videos` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "VideoPhase" AS ENUM ('phase1', 'phase2', 'phase3', 'phase4');

-- CreateEnum
CREATE TYPE "VideoType" AS ENUM ('General', 'Example', 'Exercise');

-- DropForeignKey
ALTER TABLE "videos" DROP CONSTRAINT "videos_category_id_fkey";

-- AlterTable
ALTER TABLE "videos" ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "embeded_code" TEXT NOT NULL,
ADD COLUMN     "number" INTEGER NOT NULL,
ADD COLUMN     "phase" "VideoPhase" NOT NULL,
ADD COLUMN     "type" "VideoType" NOT NULL;

-- CreateTable
CREATE TABLE "categories" (
    "id" VARCHAR(40) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "status" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" VARCHAR(40) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "status" VARCHAR(50) NOT NULL,
    "video_id" VARCHAR(40) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "videos" ADD CONSTRAINT "videos_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tags" ADD CONSTRAINT "tags_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
