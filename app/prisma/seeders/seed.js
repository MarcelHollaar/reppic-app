const { seedRoles } = require("./role-seeder");
const { seedUsers } = require("./users-seeder");
const { seedCategories } = require('./category-seeder');
const { seedTags } = require("./tag-seeder");

async function main() {
  console.log("🌱 Running seeders...");
  await seedRoles();
  await seedUsers();
  await seedCategories();
  await seedTags();
}

main()
  .catch((error) => {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
