-- Fix: "first login code rejected, second works".
-- Cause: login_otps had no uniqueness per user + non-atomic generation, so a
-- race or double login-submit could leave two rows; the earliest-emailed code
-- then silently died. This enforces exactly one live code per user.

-- 1. Remove any pre-existing duplicate rows, keeping the most recent per user
--    (a unique index cannot be created while duplicates exist).
DELETE FROM "login_otps" a
USING "login_otps" b
WHERE a."user_id" = b."user_id"
  AND a."created_at" < b."created_at";

-- Edge case: identical created_at → keep one arbitrary row per user by id.
DELETE FROM "login_otps" a
USING "login_otps" b
WHERE a."user_id" = b."user_id"
  AND a."created_at" = b."created_at"
  AND a."id" < b."id";

-- 2. Enforce one live login-OTP per user going forward.
CREATE UNIQUE INDEX "login_otps_user_id_key" ON "login_otps"("user_id");
