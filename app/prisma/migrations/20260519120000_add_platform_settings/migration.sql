-- CreateTable
CREATE TABLE "platform_settings" (
    "key" VARCHAR(64) NOT NULL,
    "value" VARCHAR(255) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("key")
);
