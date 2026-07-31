const { PrismaClient } = require("@prisma/client");
const { categoryValues } = require("../../config/seeder-data");

const prisma = new PrismaClient();

async function seedCategories() {
  console.log("Starting category seeder...");

  for (const category of categoryValues) {
    const existingCategory = await prisma.category.findFirst({
      where: { slug: category.slug },
    });

    if (!existingCategory) {
      await prisma.category.create({
        data: {
          name: category.name,
          slug: category.slug,
          status: category.status,
        },
      });
      console.log(`Category "${category.name}" seeded successfully.`);
    } else {
      console.log(`Category "${category.name}" already exists. Skipping.`);
    }
  }

  console.log("Category seeder completed.");
}

module.exports = { seedCategories };
