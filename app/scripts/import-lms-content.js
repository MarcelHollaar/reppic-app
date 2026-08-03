#!/usr/bin/env node
/**
 * LMS-integratie Fase 2: importeert de GLOBALE content uit de oude LMS-database
 * (het huidige LMS bevat alleen globale content — geen bedrijfsspecifieke).
 *
 * Stap 1 — export op de oude LMS-Postgres (Neon), draai daar:
 *
 *   \copy (SELECT row_to_json(t) FROM (SELECT * FROM categories) t)      TO 'categories.jsonl'
 *   \copy (SELECT row_to_json(t) FROM (SELECT * FROM modules) t)         TO 'modules.jsonl'
 *   \copy (SELECT row_to_json(t) FROM (SELECT * FROM questions) t)       TO 'questions.jsonl'
 *   \copy (SELECT row_to_json(t) FROM (SELECT * FROM learning_paths) t)  TO 'learning_paths.jsonl'
 *   \copy (SELECT row_to_json(t) FROM (SELECT * FROM learning_path_modules) t) TO 'learning_path_modules.jsonl'
 *   \copy (SELECT row_to_json(t) FROM (SELECT * FROM job_roles) t)       TO 'job_roles.jsonl'
 *   \copy (SELECT row_to_json(t) FROM (SELECT * FROM module_job_roles) t) TO 'module_job_roles.jsonl'
 *
 * Stap 2 — zet de .jsonl-bestanden in één map en draai hier:
 *
 *   node scripts/import-lms-content.js /pad/naar/exportmap
 *
 * Idempotent (upsert op id). Alles wordt als GLOBALE content geïmporteerd
 * (company_id = NULL), conform besluit 2026-07-26. Voortgang/certificaten
 * worden bewust NIET geïmporteerd (aparte beslissing; koppeling zou op e-mail
 * moeten omdat LMS-user-ids niet gelijk zijn aan app-user-ids).
 */
const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const dir = process.argv[2];
if (!dir || !fs.existsSync(dir)) {
  console.error("Gebruik: node scripts/import-lms-content.js /pad/naar/exportmap");
  process.exit(1);
}

function readJsonl(name) {
  const p = path.join(dir, name);
  if (!fs.existsSync(p)) {
    console.warn(`⏭️  ${name} niet gevonden — overgeslagen`);
    return [];
  }
  return fs
    .readFileSync(p, "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l));
}

// LMS 'sales-skills'/'knowledge' -> Prisma-enumwaarden
const pathType = (v) => (v === "sales-skills" ? "sales_skills" : "knowledge");
const date = (v) => (v ? new Date(v) : undefined);

async function main() {
  const stats = {};

  // Functierollen (globaal)
  const jobRoles = readJsonl("job_roles.jsonl");
  for (const r of jobRoles) {
    await prisma.jobRole.upsert({
      where: { id: r.id },
      update: {},
      create: {
        id: r.id,
        name: r.name,
        description: r.description || null,
        scope: "global",
        company_id: null,
        created_at: date(r.created_at),
      },
    });
  }
  stats.job_roles = jobRoles.length;

  // Categorieën (globaal)
  const categories = readJsonl("categories.jsonl");
  for (const c of categories) {
    await prisma.learningCategory.upsert({
      where: { id: c.id },
      update: {},
      create: {
        id: c.id,
        name: c.name,
        description: c.description || null,
        learning_path_type: pathType(c.learning_path_type),
        company_id: null,
        sort_order: c.sort_order || 0,
        created_at: date(c.created_at),
      },
    });
  }
  stats.categories = categories.length;

  // Modules (globaal; content_type presentation/document/video)
  const modules = readJsonl("modules.jsonl");
  for (const m of modules) {
    const contentType = ["video", "presentation", "document"].includes(m.content_type)
      ? m.content_type
      : "video";
    await prisma.learningModule.upsert({
      where: { id: m.id },
      update: {},
      create: {
        id: m.id,
        title: m.title,
        description: m.description || "",
        duration: m.duration || 0,
        category_id: m.category_id || null,
        learning_path_type: pathType(m.learning_path_type),
        phase: m.phase ? parseInt(m.phase, 10) || null : null,
        company_id: null,
        is_required: Boolean(m.is_required),
        content_type: contentType,
        video_url: m.video_url || null,
        video_embed_code: m.video_embed_code || null,
        thumbnail_url: m.thumbnail_url || null,
        original_language: m.original_language || "en",
        competency_tags: m.competency_tags || undefined,
        competency_summary: m.competency_summary || null,
        created_at: date(m.created_at),
      },
    });
  }
  stats.modules = modules.length;

  // Quizvragen
  const questions = readJsonl("questions.jsonl");
  for (const q of questions) {
    await prisma.learningQuestion.upsert({
      where: { id: q.id },
      update: {},
      create: {
        id: q.id,
        module_id: q.module_id,
        question: q.question,
        options: q.options || [],
        correct_answer: q.correct_answer,
        explanation: q.explanation || null,
        image_url: q.image_url || null,
        order_index: q.order_index || 0,
      },
    });
  }
  stats.questions = questions.length;

  // Leerpaden (+ koppelingen)
  const paths = readJsonl("learning_paths.jsonl");
  for (const p of paths) {
    await prisma.learningPath.upsert({
      where: { id: p.id },
      update: {},
      create: {
        id: p.id,
        job_function: p.job_function,
        level: p.level,
        description: p.description || null,
        job_role_id: p.job_role_id || null,
        company_id: null,
        created_at: date(p.created_at),
      },
    });
  }
  stats.learning_paths = paths.length;

  const pathModules = readJsonl("learning_path_modules.jsonl");
  for (const pm of pathModules) {
    await prisma.learningPathModule.upsert({
      where: { id: pm.id },
      update: {},
      create: {
        id: pm.id,
        learning_path_id: pm.learning_path_id,
        module_id: pm.module_id,
        order_index: pm.order_index || 0,
      },
    });
  }
  stats.learning_path_modules = pathModules.length;

  const moduleJobRoles = readJsonl("module_job_roles.jsonl");
  for (const mjr of moduleJobRoles) {
    await prisma.moduleJobRole.upsert({
      where: { id: mjr.id },
      update: {},
      create: {
        id: mjr.id,
        module_id: mjr.module_id,
        job_role_id: mjr.job_role_id,
        visibility: mjr.visibility || "required",
        created_at: date(mjr.created_at),
      },
    });
  }
  stats.module_job_roles = moduleJobRoles.length;

  console.log("✅ LMS-content geïmporteerd:", stats);
}

main()
  .catch((e) => {
    console.error("❌ Import mislukt:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
