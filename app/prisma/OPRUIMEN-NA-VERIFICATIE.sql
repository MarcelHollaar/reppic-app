-- ============================================================================
-- OPRUIMEN NA VERIFICATIE — oude videobibliotheek (LMS-integratie)
-- ============================================================================
-- NIET automatisch uitvoeren. Draai dit PAS nadat is geverifieerd dat:
--   1. `node scripts/migrate-videos-to-learning.js` succesvol is gedraaid, en
--   2. alle video's/voortgang zichtbaar en correct zijn onder /learning.
--
-- Deze migratie is bewust NIET als Prisma-migratie opgenomen, zodat hij niet
-- per ongeluk bij een deploy meedraait. Maak eerst een back-up.
--
-- Voer daarnaast in de code de opruiming door van de oude schermen/route's
-- (zie onderaan) en verwijder de bijbehorende modellen uit schema.prisma.
-- ============================================================================

BEGIN;

-- Veiligheidscheck: stop als er nog niet-gemigreerde video's zijn.
-- (Elke video moet als LearningModule met hetzelfde id bestaan.)
DO $$
DECLARE
  missing INT;
BEGIN
  SELECT COUNT(*) INTO missing
  FROM videos v
  WHERE NOT EXISTS (SELECT 1 FROM learning_modules m WHERE m.id = v.id);
  IF missing > 0 THEN
    RAISE EXCEPTION 'Nog % niet-gemigreerde video(s). Draai eerst migrate-videos-to-learning.js.', missing;
  END IF;
END $$;

-- Oude leer-tabellen verwijderen (volgorde: afhankelijkheden eerst).
DROP TABLE IF EXISTS "video_progress" CASCADE;
DROP TABLE IF EXISTS "suggested_videos" CASCADE;
DROP TABLE IF EXISTS "video_tags" CASCADE;
DROP TABLE IF EXISTS "videos" CASCADE;
DROP TABLE IF EXISTS "video_categories" CASCADE;
-- LET OP: `categories` en `tags` worden mogelijk nog elders gebruikt; controleer
-- vóór verwijderen. Standaard laten we ze staan.

COMMIT;

-- ----------------------------------------------------------------------------
-- Bijbehorende code-opruiming (handmatig, in een aparte commit):
--   - Verwijder uit schema.prisma: model Video, VideoCategory, VideoProgress,
--     SuggestedVideo, VideoTag (+ back-relations op User/Category/Tag) en de
--     enums VideoStatus/VideoType als ze nergens anders gebruikt worden.
--   - Verwijder de oude schermen onder app/src/app/developments/
--     (library, videos, playback, categories, tags) en hun API-routes
--     (/api/videos, /api/suggested-videos, /api/video-*).
--   - Verwijder de superadmin-submenu-items voor de oude videobibliotheek
--     in src/utils/getRoutes.tsx (Library, Add video, Categories, Tags) —
--     de nieuwe /learning-items blijven.
-- ----------------------------------------------------------------------------
