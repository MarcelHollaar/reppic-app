#!/usr/bin/env node
/**
 * Importeert de content uit de productie-LMS-database in de geïntegreerde app.
 *
 * Stap 1 — exporteer op (een kopie van) de LMS-Postgres per tabel JSONL:
 *
 *   \copy (SELECT row_to_json(t) FROM (SELECT * FROM companies) t)        TO 'companies.jsonl'
 *   \copy (SELECT row_to_json(t) FROM (SELECT * FROM users) t)            TO 'users.jsonl'
 *   \copy (SELECT row_to_json(t) FROM (SELECT * FROM categories) t)       TO 'categories.jsonl'
 *   \copy (SELECT row_to_json(t) FROM (SELECT * FROM modules) t)          TO 'modules.jsonl'
 *   \copy (SELECT row_to_json(t) FROM (SELECT * FROM questions) t)        TO 'questions.jsonl'
 *   \copy (SELECT row_to_json(t) FROM (SELECT * FROM learning_paths) t)   TO 'learning_paths.jsonl'
 *   \copy (SELECT row_to_json(t) FROM (SELECT * FROM learning_path_modules) t) TO 'learning_path_modules.jsonl'
 *   \copy (SELECT row_to_json(t) FROM (SELECT * FROM job_roles) t)        TO 'job_roles.jsonl'
 *   \copy (SELECT row_to_json(t) FROM (SELECT * FROM module_job_roles) t) TO 'module_job_roles.jsonl'
 *   \copy (SELECT row_to_json(t) FROM (SELECT * FROM translations) t)     TO 'translations.jsonl'
 *   \copy (SELECT row_to_json(t) FROM (SELECT * FROM media_items) t)      TO 'media_items.jsonl'
 *   \copy (SELECT row_to_json(t) FROM (SELECT * FROM user_progress) t)    TO 'user_progress.jsonl'
 *
 * Stap 2 — zet de .jsonl-bestanden in één map en draai hier:
 *
 *   node scripts/import-lms-content.js /pad/naar/exportmap
 *
 * Gedrag (aansluitcontrole 2026-08-06 tegen de echte productie-dump):
 *  - Idempotent (upsert op id).
 *  - BEDRIJFSGEBONDEN content (company_id gezet in het LMS) wordt via het
 *    e-mailadres van het bedrijf gekoppeld aan de app-Company. Geen match →
 *    OVERSLAAN met waarschuwing (nooit stilletjes globaal maken — tenant-lek).
 *  - DAM-paden (/public-objects/…) worden herschreven naar volledige URL's op
 *    FTP_PUBLIC_URL + FTP_FOLDER_LMS (thumbnails, document-PDF's, media).
 *  - translations (module / module_video / module_thumbnail / question) worden
 *    samengevoegd in LearningModuleTranslation.content per (module, taal) —
 *    incl. de per-taal Synthesia-video's (videoCode) en thumbnails.
 *  - user_progress wordt gekoppeld op e-mailadres van de gebruiker; geen match
 *    in de app → overslaan met telling. Wachtwoorden/gebruikers worden NOOIT
 *    geïmporteerd.
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

// /public-objects/<rest> → https://<DAM>/<FTP_FOLDER_LMS>/<rest>
const DAM_BASE = (process.env.FTP_PUBLIC_URL || "").replace(/\/$/, "");
const LMS_FOLDER = process.env.FTP_FOLDER_LMS || "lms-reppic";
function rewriteDam(value) {
  if (!value || typeof value !== "string") return value || null;
  if (!value.startsWith("/public-objects/")) return value;
  if (!DAM_BASE) {
    console.warn(`⚠️  FTP_PUBLIC_URL niet gezet — pad blijft relatief: ${value}`);
    return value;
  }
  return `${DAM_BASE}/${LMS_FOLDER}/${value.slice("/public-objects/".length)}`;
}

async function main() {
  const stats = {};
  const warn = (msg) => console.warn(`⚠️  ${msg}`);

  // ── Bedrijfskoppeling: LMS-company → app-Company via e-mail ──────────────
  const lmsCompanies = readJsonl("companies.jsonl");
  const appCompanies = await prisma.company.findMany({
    select: { id: true, email: true, title: true },
  });
  const appByEmail = new Map(
    appCompanies.map((c) => [String(c.email || "").toLowerCase().trim(), c.id]),
  );
  const companyMap = new Map(); // LMS company_id -> app company_id
  const unmatchedCompanies = [];
  for (const c of lmsCompanies) {
    const appId = appByEmail.get(String(c.email || "").toLowerCase().trim());
    if (appId) companyMap.set(c.id, appId);
    else unmatchedCompanies.push(`${c.name} <${c.email}>`);
  }
  stats.companies_matched = companyMap.size;
  stats.companies_unmatched = unmatchedCompanies.length;
  if (unmatchedCompanies.length) {
    warn(`geen app-bedrijf gevonden voor: ${unmatchedCompanies.join("; ")}`);
    warn("content van deze bedrijven wordt OVERGESLAGEN (geen tenant-lek).");
  }
  // Bedrijfsgebonden LMS-content zonder match overslaan; globaal blijft null.
  const mapCompany = (lmsCompanyId) => {
    if (!lmsCompanyId) return { ok: true, id: null };
    const id = companyMap.get(lmsCompanyId);
    return id ? { ok: true, id } : { ok: false, id: null };
  };

  // ── Functierollen ─────────────────────────────────────────────────────────
  const jobRoles = readJsonl("job_roles.jsonl");
  let jrSkipped = 0;
  for (const r of jobRoles) {
    const comp = mapCompany(r.company_id);
    if (!comp.ok) { jrSkipped++; continue; }
    await prisma.jobRole.upsert({
      where: { id: r.id },
      update: {},
      create: {
        id: r.id,
        name: r.name,
        description: r.description || null,
        scope: comp.id ? "company" : "global",
        company_id: comp.id,
        created_at: date(r.created_at),
      },
    });
  }
  stats.job_roles = jobRoles.length - jrSkipped;
  if (jrSkipped) stats.job_roles_skipped = jrSkipped;

  // ── Categorieën ───────────────────────────────────────────────────────────
  const categories = readJsonl("categories.jsonl");
  let catSkipped = 0;
  for (const c of categories) {
    const comp = mapCompany(c.company_id);
    if (!comp.ok) { catSkipped++; continue; }
    await prisma.learningCategory.upsert({
      where: { id: c.id },
      update: {},
      create: {
        id: c.id,
        name: c.name,
        description: c.description || null,
        learning_path_type: pathType(c.learning_path_type),
        company_id: comp.id,
        sort_order: c.sort_order || 0,
        created_at: date(c.created_at),
      },
    });
  }
  stats.categories = categories.length - catSkipped;
  if (catSkipped) stats.categories_skipped = catSkipped;

  // ── Modules ───────────────────────────────────────────────────────────────
  const modules = readJsonl("modules.jsonl");
  const importedModuleIds = new Set();
  let modSkipped = 0;
  for (const m of modules) {
    const comp = mapCompany(m.company_id);
    if (!comp.ok) {
      warn(`module "${m.title}" overgeslagen (onbekend bedrijf)`);
      modSkipped++;
      continue;
    }
    const contentType = ["video", "presentation", "document"].includes(m.content_type)
      ? m.content_type
      : "video";
    // Document-/presentatiemodules bewaren hun PDF als /public-objects/-pad in
    // video_embed_code → herschrijven naar volledige DAM-URL zodat de viewer
    // hem direct kan tonen.
    const embed =
      m.video_embed_code && m.video_embed_code.startsWith("/public-objects/")
        ? rewriteDam(m.video_embed_code)
        : m.video_embed_code || null;
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
        company_id: comp.id,
        is_required: Boolean(m.is_required),
        content_type: contentType,
        video_url: m.video_url || null,
        video_embed_code: embed,
        thumbnail_url: rewriteDam(m.thumbnail_url),
        original_language: m.original_language || "en",
        competency_tags: m.competency_tags || undefined,
        competency_summary: m.competency_summary || null,
        created_at: date(m.created_at),
      },
    });
    importedModuleIds.add(m.id);
  }
  stats.modules = importedModuleIds.size;
  if (modSkipped) stats.modules_skipped = modSkipped;

  // ── Quizvragen ────────────────────────────────────────────────────────────
  const questions = readJsonl("questions.jsonl");
  let qImported = 0;
  for (const q of questions) {
    if (!importedModuleIds.has(q.module_id)) continue;
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
    qImported++;
  }
  stats.questions = qImported;

  // ── Leerpaden (+ koppelingen) ─────────────────────────────────────────────
  const paths = readJsonl("learning_paths.jsonl");
  let lpSkipped = 0;
  const importedPathIds = new Set();
  for (const p of paths) {
    const comp = mapCompany(p.company_id);
    if (!comp.ok) { lpSkipped++; continue; }
    await prisma.learningPath.upsert({
      where: { id: p.id },
      update: {},
      create: {
        id: p.id,
        job_function: p.job_function,
        level: p.level,
        description: p.description || null,
        job_role_id: p.job_role_id || null,
        company_id: comp.id,
        created_at: date(p.created_at),
      },
    });
    importedPathIds.add(p.id);
  }
  stats.learning_paths = importedPathIds.size;
  if (lpSkipped) stats.learning_paths_skipped = lpSkipped;

  const pathModules = readJsonl("learning_path_modules.jsonl");
  let pmImported = 0;
  for (const pm of pathModules) {
    if (!importedPathIds.has(pm.learning_path_id)) continue;
    if (!importedModuleIds.has(pm.module_id)) continue;
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
    pmImported++;
  }
  stats.learning_path_modules = pmImported;

  const moduleJobRoles = readJsonl("module_job_roles.jsonl");
  let mjrImported = 0;
  for (const mjr of moduleJobRoles) {
    if (!importedModuleIds.has(mjr.module_id)) continue;
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
    mjrImported++;
  }
  stats.module_job_roles = mjrImported;

  // ── Vertalingen: module + module_video + module_thumbnail (+ question) ────
  // Productie bewaart per (entiteit, taal) een JSON; wij voegen alles samen in
  // LearningModuleTranslation.content: { title, description, videoCode,
  // thumbnailUrl, questions }. Zo krijgt een Duitse gebruiker de Dúítse
  // Synthesia-video (klant-eis taalgedrag 1-op-1).
  const translations = readJsonl("translations.jsonl");
  const merged = new Map(); // `${moduleId}|${lang}` -> content-object
  let trSkippedOrphan = 0;
  for (const t of translations) {
    const lang = t.language;
    const tc = t.translated_content || {};
    let moduleId = null;
    let patch = null;
    if (t.entity_type === "module") {
      moduleId = t.entity_id;
      patch = { title: tc.title, description: tc.description };
    } else if (t.entity_type === "module_video") {
      moduleId = t.entity_id;
      patch = { videoCode: tc.videoCode };
    } else if (t.entity_type === "module_thumbnail") {
      moduleId = t.entity_id;
      patch = { thumbnailUrl: rewriteDam(tc.thumbnailUrl) };
    } else {
      continue; // question-vertalingen: alleen relevant zodra er vragen zijn
    }
    if (!importedModuleIds.has(moduleId)) { trSkippedOrphan++; continue; }
    const key = `${moduleId}|${lang}`;
    const existing = merged.get(key) || {};
    for (const [k, v] of Object.entries(patch)) {
      if (v !== undefined && v !== null && v !== "") existing[k] = v;
    }
    merged.set(key, existing);
  }
  let trUpserts = 0;
  for (const [key, content] of merged) {
    const [moduleId, language] = key.split("|");
    const current = await prisma.learningModuleTranslation.findUnique({
      where: {
        learning_module_translation_unique: { module_id: moduleId, language },
      },
      select: { content: true },
    });
    const mergedContent = { ...(current?.content || {}), ...content };
    await prisma.learningModuleTranslation.upsert({
      where: {
        learning_module_translation_unique: { module_id: moduleId, language },
      },
      update: { content: mergedContent },
      create: { module_id: moduleId, language, content: mergedContent },
    });
    trUpserts++;
  }
  stats.module_translations = trUpserts;
  if (trSkippedOrphan) stats.translations_skipped_orphan = trSkippedOrphan;

  // ── Media-bibliotheek (Brand Kit) ─────────────────────────────────────────
  const mediaItems = readJsonl("media_items.jsonl");
  let miImported = 0;
  let miSkipped = 0;
  for (const mi of mediaItems) {
    const comp = mapCompany(mi.company_id);
    if (!comp.ok) { miSkipped++; continue; }
    await prisma.learningMediaItem.upsert({
      where: { id: mi.id },
      update: {},
      create: {
        id: mi.id,
        name: mi.name,
        type: mi.type,
        url: rewriteDam(mi.url),
        pdf_url: rewriteDam(mi.pdf_url),
        file_size: mi.file_size || null,
        mime_type: mi.mime_type || null,
        tags: mi.tags || undefined,
        company_id: comp.id,
        uploaded_by: null, // LMS-user-ids bestaan niet in de app
        created_at: date(mi.created_at),
      },
    });
    miImported++;
  }
  stats.media_items = miImported;
  if (miSkipped) stats.media_items_skipped = miSkipped;

  // ── Voortgang: koppelen op e-mailadres ────────────────────────────────────
  const lmsUsers = readJsonl("users.jsonl");
  const lmsUserEmail = new Map(
    lmsUsers.map((u) => [u.id, String(u.email || "").toLowerCase().trim()]),
  );
  const appUsers = await prisma.user.findMany({ select: { id: true, email: true } });
  const appUserByEmail = new Map(
    appUsers.map((u) => [String(u.email || "").toLowerCase().trim(), u.id]),
  );
  const progress = readJsonl("user_progress.jsonl");
  const statusMap = {
    "not-started": "not_started",
    "in-progress": "in_progress",
    completed: "completed",
  };
  let prImported = 0;
  let prSkipped = 0;
  for (const pr of progress) {
    const email = lmsUserEmail.get(pr.user_id);
    const appUserId = email ? appUserByEmail.get(email) : null;
    if (!appUserId || !importedModuleIds.has(pr.module_id)) { prSkipped++; continue; }
    await prisma.learningProgress.upsert({
      where: {
        learning_progress_user_module_unique: {
          user_id: appUserId,
          module_id: pr.module_id,
        },
      },
      update: {},
      create: {
        user_id: appUserId,
        module_id: pr.module_id,
        status: statusMap[pr.status] || "not_started",
        progress: pr.progress || 0,
        score: pr.score ?? null,
        answers: pr.answers || undefined,
        time_spent: pr.time_spent || 0,
        started_at: pr.started_at ? new Date(pr.started_at) : null,
        completed_at: pr.completed_at ? new Date(pr.completed_at) : null,
        last_accessed_at: pr.last_accessed_at
          ? new Date(pr.last_accessed_at)
          : new Date(),
      },
    });
    prImported++;
  }
  stats.user_progress = prImported;
  if (prSkipped) stats.user_progress_skipped = prSkipped;

  console.log("✅ LMS-content geïmporteerd:", stats);
}

main()
  .catch((e) => {
    console.error("❌ Import mislukt:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
