const { PrismaClient } = require("@prisma/client");
const { tagValues } = require("../../config/seeder-data");

const prisma = new PrismaClient();

async function seedTags() {
  console.log("Starting tag seeder...");

  for (const tag of tagValues) {
    const existingTag = await prisma.tag.findFirst({
      where: { slug: tag.slug },
    });

    if (!existingTag) {
      await prisma.tag.create({
        data: {
          name: tag.name,
          slug: tag.slug,
          status: tag.status,
        },
      });
      console.log(`Tag "${tag.name}" seeded successfully.`);
    } else {
      console.log(`Tag "${tag.name}" already exists. Skipping.`);
    }
  }

  console.log("Tag seeder completed.");
}

module.exports = { seedTags };
