-- LMS 1:1 P4: module-embeddings + leerpad-competenties (port productie-LMS).
CREATE TABLE "learning_module_embeddings" (
    "id" VARCHAR(40) NOT NULL,
    "module_id" VARCHAR(40) NOT NULL,
    "embedding" TEXT NOT NULL,
    "model" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learning_module_embeddings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "learning_module_embeddings_module_id_key" ON "learning_module_embeddings"("module_id");

ALTER TABLE "learning_module_embeddings" ADD CONSTRAINT "learning_module_embeddings_module_id_fkey"
    FOREIGN KEY ("module_id") REFERENCES "learning_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "learning_path_competencies" (
    "id" VARCHAR(40) NOT NULL,
    "learning_path_id" VARCHAR(40) NOT NULL,
    "competencies" JSONB NOT NULL,
    "job_profile_text" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learning_path_competencies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "learning_path_competencies_learning_path_id_key" ON "learning_path_competencies"("learning_path_id");

ALTER TABLE "learning_path_competencies" ADD CONSTRAINT "learning_path_competencies_learning_path_id_fkey"
    FOREIGN KEY ("learning_path_id") REFERENCES "learning_paths"("id") ON DELETE CASCADE ON UPDATE CASCADE;
