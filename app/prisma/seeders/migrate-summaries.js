const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

/**
 * Migration script: ConversationSummary → ConversationSummaryX
 * 
 * Field Mapping:
 * - conversation_id → conversation_id (direct)
 * - summary → summary_text (direct)
 * - learning_points (Json) → learning_points (String[]) (parse)
 * - score (Float) → total_score (Int) (Math.round)
 * - salesperson_speak_percentage (Float) → salesperson_percentage (Int) (Math.round)
 * - phases → phases (direct)
 * - customer_type → customer_type (direct)
 * - atmosphere → atmosphere (direct)
 * - custom_data.transcribed_text → transcribed_text (extract)
 * - custom_data.mail_text → mail_text (extract)
 * - custom_data.resistance_text → resistance_text (extract)
 * - custom_data.resistances → resistances (extract)
 */

async function migrateSummaries() {
  console.log("🚀 Starting migration: ConversationSummary → ConversationSummaryX\n");

  try {
    // 1. Fetch all old ConversationSummary records
    const oldSummaries = await prisma.conversationSummary.findMany();
    console.log(`📋 Found ${oldSummaries.length} records to migrate\n`);

    if (oldSummaries.length === 0) {
      console.log("✅ No records to migrate. Exiting.");
      return;
    }

    let migrated = 0;
    let skipped = 0;
    let errors = 0;

    for (const oldSummary of oldSummaries) {
      try {
        // 2. Check if already migrated (based on conversation_id)
        const existing = await prisma.conversationSummaryX.findFirst({
          where: { conversation_id: oldSummary.conversation_id },
        });

        if (existing) {
          console.log(`⏭️  Skipping ${oldSummary.id} - already migrated (conversation: ${oldSummary.conversation_id})`);
          skipped++;
          continue;
        }

        // 3. Transform and map fields
        const customData = oldSummary.custom_data || {};

        // Parse learning_points from Json to String[]
        let learningPoints = [];
        if (oldSummary.learning_points) {
          if (Array.isArray(oldSummary.learning_points)) {
            learningPoints = oldSummary.learning_points.map(String);
          } else if (typeof oldSummary.learning_points === "object") {
            learningPoints = Object.values(oldSummary.learning_points).map(String);
          }
        }

        const newData = {
          conversation_id: oldSummary.conversation_id,
          summary_text: oldSummary.summary || null,
          learning_points: learningPoints,
          total_score: oldSummary.score ? Math.round(oldSummary.score) : null,
          salesperson_percentage: oldSummary.salesperson_speak_percentage
            ? Math.round(oldSummary.salesperson_speak_percentage)
            : null,
          phases: oldSummary.phases || null,
          customer_type: oldSummary.customer_type || null,
          atmosphere: oldSummary.atmosphere || null,
          // Extract from custom_data if exists
          transcribed_text: customData.transcribed_text || null,
          mail_text: customData.mail_text || null,
          resistance_text: customData.resistance_text || null,
          resistances: customData.resistances || null,
        };

        // 4. Insert into ConversationSummaryX
        await prisma.conversationSummaryX.create({
          data: newData,
        });

        console.log(`✅ Migrated ${oldSummary.id} → conversation: ${oldSummary.conversation_id}`);
        migrated++;
      } catch (error) {
        console.error(`❌ Error migrating ${oldSummary.id}:`, error.message);
        errors++;
      }
    }

    console.log("\n" + "=".repeat(50));
    console.log("📊 Migration Summary:");
    console.log(`   ✅ Migrated: ${migrated}`);
    console.log(`   ⏭️  Skipped:  ${skipped}`);
    console.log(`   ❌ Errors:   ${errors}`);
    console.log("=".repeat(50));

  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
migrateSummaries()
  .then(() => {
    console.log("\n🎉 Migration completed!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Migration failed:", error);
    process.exit(1);
  });

