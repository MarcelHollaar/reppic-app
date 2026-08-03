-- LMS-integratie Fase 2: leerdomein (geport uit Reppic-LMS).
-- Identiteit blijft in bestaande users/companies-tabellen.

-- CreateEnum
CREATE TYPE "LearningPathType" AS ENUM ('sales_skills', 'knowledge');
CREATE TYPE "LearningContentType" AS ENUM ('video', 'presentation', 'document');
CREATE TYPE "LearningProgressStatus" AS ENUM ('not_started', 'in_progress', 'completed');

-- CreateTable job_roles
CREATE TABLE "job_roles" (
    "id" VARCHAR(40) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "scope" VARCHAR(20) NOT NULL DEFAULT 'company',
    "company_id" VARCHAR(40),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "job_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable learning_categories
CREATE TABLE "learning_categories" (
    "id" VARCHAR(40) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "learning_path_type" "LearningPathType" NOT NULL DEFAULT 'knowledge',
    "company_id" VARCHAR(40),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_by" VARCHAR(40),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "learning_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable learning_modules
CREATE TABLE "learning_modules" (
    "id" VARCHAR(40) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "duration" INTEGER NOT NULL DEFAULT 0,
    "category_id" VARCHAR(40),
    "learning_path_type" "LearningPathType" NOT NULL DEFAULT 'knowledge',
    "phase" INTEGER,
    "company_id" VARCHAR(40),
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "content_type" "LearningContentType" NOT NULL DEFAULT 'video',
    "video_url" TEXT,
    "video_embed_code" TEXT,
    "thumbnail_url" TEXT,
    "original_language" VARCHAR(10) NOT NULL DEFAULT 'en',
    "competency_tags" JSONB,
    "competency_summary" TEXT,
    "created_by" VARCHAR(40),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "learning_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable learning_questions
CREATE TABLE "learning_questions" (
    "id" VARCHAR(40) NOT NULL,
    "module_id" VARCHAR(40) NOT NULL,
    "question" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "correct_answer" INTEGER NOT NULL,
    "explanation" TEXT,
    "image_url" TEXT,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "learning_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable learning_progress
CREATE TABLE "learning_progress" (
    "id" VARCHAR(40) NOT NULL,
    "user_id" VARCHAR(40) NOT NULL,
    "module_id" VARCHAR(40) NOT NULL,
    "status" "LearningProgressStatus" NOT NULL DEFAULT 'not_started',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "score" INTEGER,
    "answers" JSONB,
    "time_spent" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "last_accessed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "learning_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable learning_certificates
CREATE TABLE "learning_certificates" (
    "id" VARCHAR(40) NOT NULL,
    "user_id" VARCHAR(40) NOT NULL,
    "module_id" VARCHAR(40) NOT NULL,
    "certificate_number" VARCHAR(64) NOT NULL,
    "score" INTEGER NOT NULL,
    "completed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "learning_certificates_pkey" PRIMARY KEY ("id")
);

-- CreateTable learning_paths
CREATE TABLE "learning_paths" (
    "id" VARCHAR(40) NOT NULL,
    "job_function" VARCHAR(150) NOT NULL,
    "level" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "job_role_id" VARCHAR(40),
    "company_id" VARCHAR(40),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "learning_paths_pkey" PRIMARY KEY ("id")
);

-- CreateTable learning_path_modules
CREATE TABLE "learning_path_modules" (
    "id" VARCHAR(40) NOT NULL,
    "learning_path_id" VARCHAR(40) NOT NULL,
    "module_id" VARCHAR(40) NOT NULL,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "learning_path_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable module_job_roles
CREATE TABLE "module_job_roles" (
    "id" VARCHAR(40) NOT NULL,
    "module_id" VARCHAR(40) NOT NULL,
    "job_role_id" VARCHAR(40) NOT NULL,
    "visibility" VARCHAR(20) NOT NULL DEFAULT 'required',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "module_job_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable user_module_assignments
CREATE TABLE "user_module_assignments" (
    "id" VARCHAR(40) NOT NULL,
    "user_id" VARCHAR(40) NOT NULL,
    "module_id" VARCHAR(40) NOT NULL,
    "assigned_by" VARCHAR(40),
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "due_date" TIMESTAMP(3),
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "user_module_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable user_learning_path_assignments
CREATE TABLE "user_learning_path_assignments" (
    "id" VARCHAR(40) NOT NULL,
    "user_id" VARCHAR(40) NOT NULL,
    "learning_path_id" VARCHAR(40) NOT NULL,
    "assigned_by" VARCHAR(40),
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_learning_path_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable library_categories
CREATE TABLE "library_categories" (
    "id" VARCHAR(40) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "icon" VARCHAR(50),
    "company_id" VARCHAR(40) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_by" VARCHAR(40),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "library_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable library_documents
CREATE TABLE "library_documents" (
    "id" VARCHAR(40) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "category_id" VARCHAR(40),
    "company_id" VARCHAR(40) NOT NULL,
    "content_type" VARCHAR(20) NOT NULL DEFAULT 'document',
    "file_url" TEXT,
    "external_url" TEXT,
    "thumbnail_url" TEXT,
    "file_size" INTEGER,
    "mime_type" VARCHAR(100),
    "tags" JSONB,
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "uploaded_by" VARCHAR(40),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "library_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable library_favorites
CREATE TABLE "library_favorites" (
    "id" VARCHAR(40) NOT NULL,
    "user_id" VARCHAR(40) NOT NULL,
    "document_id" VARCHAR(40) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "library_favorites_pkey" PRIMARY KEY ("id")
);

-- Indexes & uniques
CREATE UNIQUE INDEX "learning_categories_learning_path_type_company_id_name_key" ON "learning_categories"("learning_path_type", "company_id", "name");
CREATE INDEX "idx_learning_modules_company" ON "learning_modules"("company_id");
CREATE INDEX "idx_learning_modules_path_type" ON "learning_modules"("learning_path_type");
CREATE INDEX "idx_learning_questions_module" ON "learning_questions"("module_id");
CREATE UNIQUE INDEX "learning_progress_user_id_module_id_key" ON "learning_progress"("user_id", "module_id");
CREATE UNIQUE INDEX "learning_certificates_certificate_number_key" ON "learning_certificates"("certificate_number");
CREATE INDEX "idx_learning_certificates_user" ON "learning_certificates"("user_id");
CREATE UNIQUE INDEX "learning_path_modules_learning_path_id_module_id_key" ON "learning_path_modules"("learning_path_id", "module_id");
CREATE UNIQUE INDEX "module_job_roles_module_id_job_role_id_key" ON "module_job_roles"("module_id", "job_role_id");
CREATE UNIQUE INDEX "user_module_assignments_user_id_module_id_key" ON "user_module_assignments"("user_id", "module_id");
CREATE UNIQUE INDEX "user_learning_path_assignments_user_id_learning_path_id_key" ON "user_learning_path_assignments"("user_id", "learning_path_id");
CREATE INDEX "idx_library_documents_company" ON "library_documents"("company_id");
CREATE UNIQUE INDEX "library_favorites_user_id_document_id_key" ON "library_favorites"("user_id", "document_id");

-- Foreign keys
ALTER TABLE "job_roles" ADD CONSTRAINT "job_roles_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "learning_categories" ADD CONSTRAINT "learning_categories_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "learning_modules" ADD CONSTRAINT "learning_modules_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "learning_modules" ADD CONSTRAINT "learning_modules_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "learning_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "learning_questions" ADD CONSTRAINT "learning_questions_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "learning_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "learning_progress" ADD CONSTRAINT "learning_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "learning_progress" ADD CONSTRAINT "learning_progress_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "learning_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "learning_certificates" ADD CONSTRAINT "learning_certificates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "learning_certificates" ADD CONSTRAINT "learning_certificates_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "learning_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "learning_paths" ADD CONSTRAINT "learning_paths_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "learning_paths" ADD CONSTRAINT "learning_paths_job_role_id_fkey" FOREIGN KEY ("job_role_id") REFERENCES "job_roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "learning_path_modules" ADD CONSTRAINT "learning_path_modules_learning_path_id_fkey" FOREIGN KEY ("learning_path_id") REFERENCES "learning_paths"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "learning_path_modules" ADD CONSTRAINT "learning_path_modules_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "learning_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "module_job_roles" ADD CONSTRAINT "module_job_roles_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "learning_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "module_job_roles" ADD CONSTRAINT "module_job_roles_job_role_id_fkey" FOREIGN KEY ("job_role_id") REFERENCES "job_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_module_assignments" ADD CONSTRAINT "user_module_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_module_assignments" ADD CONSTRAINT "user_module_assignments_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "learning_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_learning_path_assignments" ADD CONSTRAINT "user_learning_path_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_learning_path_assignments" ADD CONSTRAINT "user_learning_path_assignments_learning_path_id_fkey" FOREIGN KEY ("learning_path_id") REFERENCES "learning_paths"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "library_categories" ADD CONSTRAINT "library_categories_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "library_documents" ADD CONSTRAINT "library_documents_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "library_documents" ADD CONSTRAINT "library_documents_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "library_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "library_favorites" ADD CONSTRAINT "library_favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "library_favorites" ADD CONSTRAINT "library_favorites_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "library_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
