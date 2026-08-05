-- LMS 1:1 P6: losse leertags + onboarding-tourvoortgang (port productie-LMS).
CREATE TABLE "learning_tags" (
    "id" VARCHAR(40) NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "description" TEXT,
    "created_by" VARCHAR(40),
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learning_tags_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "learning_tags_name_key" ON "learning_tags"("name");

CREATE TABLE "user_tour_progress" (
    "id" VARCHAR(40) NOT NULL,
    "user_id" VARCHAR(40) NOT NULL,
    "tour_id" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "current_step" INTEGER NOT NULL DEFAULT 0,
    "completed_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_tour_progress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_tour_progress_user_id_tour_id_key" ON "user_tour_progress"("user_id", "tour_id");
