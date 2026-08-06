-- Widen platform_settings.value from VarChar(255) to TEXT so long settings
-- (e.g. the multi-language calendar disclaimer JSON) fit. Safe widening.
ALTER TABLE "platform_settings" ALTER COLUMN "value" SET DATA TYPE TEXT;
