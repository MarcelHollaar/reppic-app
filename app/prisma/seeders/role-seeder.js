const { PrismaClient } = require("@prisma/client");
const crypto = require("crypto");

const prisma = new PrismaClient();

async function seedRoles() {
  const roleNames = ["superadmin", "manager", "user"];

  const existingRoles = await prisma.role.findMany({
    where: { name: { in: roleNames } },
    select: { name: true },
  });

  const existingRoleNames = new Set(existingRoles.map((r) => r.name));

  const rolesToSeed = roleNames
    .filter((name) => !existingRoleNames.has(name))
    .map((name) => ({
      name,
      id: crypto.randomUUID(),
      description: `${name.charAt(0).toUpperCase() + name.slice(1)} role`,
      status: "active",
    }));

  if (rolesToSeed.length === 0) {
    console.log("⏭️ All roles already exist. Skipping seeding.");
    return;
  }

  await Promise.all(
    rolesToSeed.map((role) =>
      prisma.role.upsert({
        where: { name: role.name },
        update: {},
        create: role,
      })
    )
  );

  console.log("✅ Roles seeded successfully!");
}

module.exports = { seedRoles };
