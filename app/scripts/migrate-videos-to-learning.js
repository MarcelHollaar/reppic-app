#!/usr/bin/env node
/**
 * LMS-integratie Fase 2 (beslissing B2): migreert de oude videobibliotheek
 * naar het nieuwe leerdomein.
 *
 *   Category        -> LearningCategory  (sales_skills, globaal, zelfde id)
 *   Video           -> LearningModule    (content_type=video, zelfde id)
 *   VideoProgress   -> LearningProgress  (Float seconden/percentage -> % 0-100)
 *   SuggestedVideo  -> UserModuleAssignment (is_required=false, aanbevolen)
 *
 * Idempotent: draait op upsert per id; bestaande rijen worden niet gedupliceerd.
 * De oude tabellen worden NIET verwijderd — dat gebeurt pas in een aparte
 * opruim-migratie nadat de nieuwe schermen geverifieerd zijn.
 *
 * Draaien:  node scripts/migrate-videos-to-learning.js
 * Vereist:  DATABASE_URL in env; `prisma migrate deploy` moet al gedraaid zijn.
 */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const stats = { categories: 0, modules: 0, progress: 0, assignments: 0 };

  // 1. Videocategorieën -> leer-categorieën (globaal, sales_skills)
  const categories = await prisma.category.findMany({
    where: { deleted_at: null },
  });
  for (const cat of categories) {
    await prisma.learningCategory.upsert({
      where: { id: cat.id },
      update: {},
      create: {
        id: cat.id,
        name: cat.name,
        description: null,
        learning_path_type: "sales_skills",
        company_id: null,
        created_at: cat.created_at,
      },
    });
    stats.categories++;
  }

  // 2. Video's -> leermodules (zelfde id, globaal)
  const videos = await prisma.video.findMany();
  for (const video of videos) {
    await prisma.learningModule.upsert({
      where: { id: video.id },
      update: {},
      create: {
        id: video.id,
        title: video.title,
        description: video.description || "",
        duration: video.length ? Math.max(1, Math.round(video.length / 60)) : 0,
        category_id: video.category_id,
        learning_path_type: "sales_skills",
        phase: video.phase ?? null,
        company_id: null,
        content_type: "video",
        video_embed_code: video.embedded_code || null,
        thumbnail_url: video.thumbnail_path || null,
        created_by: video.uploaded_by,
        created_at: video.created_at,
        deleted_at: video.deleted_at,
      },
    });
    stats.modules++;
  }

  // 3. Kijkvoortgang -> leer-voortgang
  const videoById = new Map(videos.map((v) => [v.id, v]));
  const allProgress = await prisma.videoProgress.findMany();
  for (const vp of allProgress) {
    const video = videoById.get(vp.video_id);
    if (!video) continue;
    // VideoProgress.progress is "seconds or percentage"; normaliseer naar 0-100.
    let percent;
    if (video.length && vp.progress > 100) {
      percent = Math.min(100, Math.round((vp.progress / video.length) * 100));
    } else {
      percent = Math.min(100, Math.round(vp.progress));
    }
    const completed = percent >= 90;
    await prisma.learningProgress.upsert({
      where: {
        learning_progress_user_module_unique: {
          user_id: vp.user_id,
          module_id: vp.video_id,
        },
      },
      update: {},
      create: {
        user_id: vp.user_id,
        module_id: vp.video_id,
        status: completed ? "completed" : percent > 0 ? "in_progress" : "not_started",
        progress: percent,
        started_at: vp.created_at,
        completed_at: completed ? vp.updated_at : null,
        last_accessed_at: vp.updated_at,
      },
    });
    stats.progress++;
  }

  // 4. Voorgestelde video's -> aanbevolen module-toewijzingen
  const suggested = await prisma.suggestedVideo.findMany();
  for (const s of suggested) {
    if (!videoById.has(s.video_id)) continue;
    await prisma.userModuleAssignment.upsert({
      where: {
        user_module_assignment_unique: {
          user_id: s.user_id,
          module_id: s.video_id,
        },
      },
      update: {},
      create: {
        user_id: s.user_id,
        module_id: s.video_id,
        is_required: false,
        assigned_at: s.created_at,
      },
    });
    stats.assignments++;
  }

  console.log("✅ Migratie klaar:", stats);
}

main()
  .catch((e) => {
    console.error("❌ Migratie mislukt:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
