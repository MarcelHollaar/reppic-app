-- AI-uitbreiding: meertalige module-content.
CREATE TABLE "learning_module_translations" (
    "id" VARCHAR(40) NOT NULL,
    "module_id" VARCHAR(40) NOT NULL,
    "language" VARCHAR(10) NOT NULL,
    "content" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "learning_module_translations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "learning_module_translations_module_id_language_key" ON "learning_module_translations"("module_id", "language");
ALTER TABLE "learning_module_translations" ADD CONSTRAINT "learning_module_translations_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "learning_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
