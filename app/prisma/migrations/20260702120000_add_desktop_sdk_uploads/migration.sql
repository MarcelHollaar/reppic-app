-- Mapping between a Recall.ai Desktop SDK upload and the Reppic user who
-- requested the upload token. The desktop app asks an authenticated user for a
-- token, so we know the owner up front; the sdk_upload.complete webhook uses
-- this table to attribute the recording deterministically (no organizer-email
-- guessing like the bot flow). `status` guards against duplicate webhook
-- deliveries (pending -> processed / failed).
CREATE TABLE "desktop_sdk_uploads" (
    "id" VARCHAR(40) NOT NULL,
    "upload_id" VARCHAR(64) NOT NULL,
    "user_id" VARCHAR(40) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "desktop_sdk_uploads_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "desktop_sdk_uploads_upload_id_key" ON "desktop_sdk_uploads"("upload_id");
CREATE INDEX "idx_desktop_sdk_uploads_user" ON "desktop_sdk_uploads"("user_id");
