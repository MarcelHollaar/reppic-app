-- LMS 1:1 P5: media-bibliotheek / Brand Kit (port van productie media_items).
CREATE TABLE "media_items" (
    "id" VARCHAR(40) NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "pdf_url" TEXT,
    "file_size" INTEGER,
    "mime_type" TEXT,
    "tags" JSONB,
    "company_id" VARCHAR(40),
    "uploaded_by" VARCHAR(40),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_media_items_company" ON "media_items"("company_id");
