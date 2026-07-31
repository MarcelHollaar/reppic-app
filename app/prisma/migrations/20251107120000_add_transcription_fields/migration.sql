ALTER TABLE "user_conversations"
ADD COLUMN "transcript_text" TEXT,
ADD COLUMN "transcript_status" VARCHAR(50) DEFAULT 'pending',
ADD COLUMN "transcription_provider" VARCHAR(50) DEFAULT 'whisper',
ADD COLUMN "audio_retention_until" TIMESTAMP(3);
