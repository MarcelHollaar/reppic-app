-- LMS 1:1 P3: Help-center (help_categories + help_articles), port van productie-LMS.
CREATE TABLE "help_categories" (
    "id" VARCHAR(40) NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "help_categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "help_articles" (
    "id" VARCHAR(40) NOT NULL,
    "category_id" VARCHAR(40),
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "excerpt" TEXT,
    "page_context" TEXT,
    "target_role" TEXT NOT NULL DEFAULT 'all',
    "language" TEXT NOT NULL DEFAULT 'en',
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "created_by" VARCHAR(40),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "help_articles_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_help_articles_page_context" ON "help_articles"("page_context");

ALTER TABLE "help_articles" ADD CONSTRAINT "help_articles_category_id_fkey"
    FOREIGN KEY ("category_id") REFERENCES "help_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
