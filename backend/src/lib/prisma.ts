import { PrismaClient } from "@prisma/client";

// The globalThis singleton is a Next.js HMR pattern — not needed here.
// In tests, NODE_ENV=test bypasses it so each test run gets a fresh client
// bound to whatever DATABASE_URL is set in the environment at startup.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "test") {
  globalForPrisma.prisma = prisma;
}
