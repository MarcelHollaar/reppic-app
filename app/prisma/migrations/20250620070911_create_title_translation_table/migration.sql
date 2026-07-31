-- CreateEnum
CREATE TYPE "TranslationType" AS ENUM ('video', 'category', 'tag');

-- CreateTable
CREATE TABLE "title_translations" (
    "id" VARCHAR(40) NOT NULL,
    "lang_code" VARCHAR(10) NOT NULL,
    "type" "TranslationType" NOT NULL,
    "type_id" VARCHAR(50) NOT NULL,
    "value" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "title_translations_pkey" PRIMARY KEY ("id")
);

/*
  Warnings:

  - A unique constraint covering the columns `[type,type_id,lang_code]` on the table `title_translations` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "title_translations_type_type_id_lang_code_key" ON "title_translations"("type", "type_id", "lang_code");
