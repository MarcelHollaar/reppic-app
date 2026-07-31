const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function seedUsers() {
  // Hash the password
  const hashedPassword = await bcrypt.hash('TiJr+0b%C]UyB%', 10);

  // Fetch role IDs dynamically
  const adminRole = await prisma.role.findFirst({ where: { name: 'superadmin' } });
  // const managerRole = await prisma.role.findFirst({ where: { name: 'manager' } });
  // const userRole = await prisma.role.findFirst({ where: { name: 'user' } });

  if (!adminRole) {
    console.error("❌ Error: One or more roles are missing. Run role seeder first.");
    process.exit(1);
  }

  // Users to create
  const users = [
    {
      name: 'Admin User',
      email: 'amisi@mytechpartner.nl',
      password: hashedPassword,
      status: 'active',
      phone_number: '9999999999',
      is_verified: true,
      role: { connect: { id: adminRole.id } }
    }
  ];

  // Create users
  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email }, // Ensure uniqueness
      update: {}, // No update, just ensure it's present
      create: user,
    });
  }

  console.log("✅ Users seeded successfully!");
}

module.exports = { seedUsers };
