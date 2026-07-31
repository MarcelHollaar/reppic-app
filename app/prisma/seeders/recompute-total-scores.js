const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

/**
 * Backfill: recompute `conversation_summaries_x.total_score` for ALL existing
 * conversations using the phase-average formula (the "old" calculation):
 *
 *   total_score = (sum of the 15 phase scores (each 0/1/3) / (15 * 3)) * 10
 *
 * Weerstanden do NOT count. This is fully deterministic from the stored
 * `phases`, so NO LLM call is needed. It matches computeTotaalscore() in
 * app/src/lib/transcript-analysis/analyze.ts.
 *
 * Usage (run from app/):
 *   node prisma/seeders/recompute-total-scores.js           # DRY-RUN (no writes)
 *   node prisma/seeders/recompute-total-scores.js --apply   # write the changes
 *
 * IMPORTANT: run the Prisma migrations first (total_score must already be
 * DOUBLE PRECISION — migration 20260630120000_total_score_to_float), otherwise
 * the decimal scores cannot be stored.
 */

const FASE_COUNT = 15;
const MAX_FASE_SCORE = 3;
const DENOMINATOR = FASE_COUNT * MAX_FASE_SCORE; // 45

function toPhaseArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** total = (sum of phase scores / 45) * 10, clamped 0-10, 1 decimal. */
function computeTotalFromPhases(phases) {
  const sum = phases.reduce((acc, p) => {
    const n = Number(p && p.Score);
    return acc + (Number.isFinite(n) ? n : 0);
  }, 0);
  const raw = (sum / DENOMINATOR) * 10;
  return { sum, score: parseFloat(Math.max(0, Math.min(10, raw)).toFixed(1)) };
}

async function main() {
  const apply = process.argv.includes("--apply");
  console.log(
    `\n🔢 Recompute total_score — ${apply ? "APPLY (writing changes)" : "DRY-RUN (no writes)"}\n`,
  );

  const rows = await prisma.conversationSummaryX.findMany({
    select: { id: true, conversation_id: true, total_score: true, phases: true },
  });
  console.log(`📋 ${rows.length} conversation_summaries_x rows found\n`);

  let updated = 0;
  let unchanged = 0;
  let noPhases = 0;
  let sumOld = 0;
  let sumNew = 0;
  let counted = 0;

  for (const row of rows) {
    const phases = toPhaseArray(row.phases);
    if (phases.length === 0) {
      noPhases += 1;
      continue;
    }

    const { sum, score: newScore } = computeTotalFromPhases(phases);
    const oldScore = row.total_score;

    counted += 1;
    sumOld += Number(oldScore ?? 0);
    sumNew += newScore;

    const changed = oldScore == null || Number(oldScore).toFixed(1) !== newScore.toFixed(1);
    if (changed) {
      updated += 1;
      console.log(
        `  ${row.conversation_id}: ${oldScore == null ? "—" : Number(oldScore).toFixed(1)} → ${newScore.toFixed(1)}  (som ${sum}/${DENOMINATOR}, ${phases.length} fases)`,
      );
      if (apply) {
        await prisma.conversationSummaryX.update({
          where: { id: row.id },
          data: { total_score: newScore },
        });
      }
    } else {
      unchanged += 1;
    }
  }

  const avgOld = counted ? (sumOld / counted).toFixed(2) : "—";
  const avgNew = counted ? (sumNew / counted).toFixed(2) : "—";

  console.log("\n──────── Samenvatting ────────");
  console.log(`  Rijen met fases        : ${counted}`);
  console.log(`  Zonder fases (skipped) : ${noPhases}`);
  console.log(`  Gewijzigd              : ${updated}`);
  console.log(`  Ongewijzigd            : ${unchanged}`);
  console.log(`  Gemiddelde score OUD   : ${avgOld}`);
  console.log(`  Gemiddelde score NIEUW : ${avgNew}`);
  console.log(
    apply
      ? "\n✅ Wijzigingen weggeschreven.\n"
      : "\nℹ️  Dry-run — er is niets gewijzigd. Draai met --apply om weg te schrijven.\n",
  );
}

main()
  .catch((e) => {
    console.error("❌ Recompute failed:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
