import { PrismaClient } from "@prisma/client";

// Cached on globalThis in non-production so Next.js dev hot-reload doesn't
// spawn a new PrismaClient (and exhaust Postgres connections) on every reload.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
