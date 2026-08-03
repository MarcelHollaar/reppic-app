-- AI-uitbreiding: embeddings voor semantisch zoeken in de Kennisbibliotheek.

-- CreateTable
CREATE TABLE "library_document_embeddings" (
    "id" VARCHAR(40) NOT NULL,
    "document_id" VARCHAR(40) NOT NULL,
    "company_id" VARCHAR(40) NOT NULL,
    "embedding" TEXT NOT NULL,
    "text_content" TEXT,
    "model" VARCHAR(100) NOT NULL,
    "indexed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "library_document_embeddings_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "library_document_embeddings_document_id_key" ON "library_document_embeddings"("document_id");
CREATE INDEX "idx_library_doc_embeddings_company" ON "library_document_embeddings"("company_id");

-- Foreign key
ALTER TABLE "library_document_embeddings" ADD CONSTRAINT "library_document_embeddings_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "library_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
