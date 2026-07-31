import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // optional:
    // log: ["error", "warn"],
  });

// In dev, Next.js hot-reloads files a lot, so we store the client on globalThis
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
