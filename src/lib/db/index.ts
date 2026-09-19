import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    // Pooled Supabase (pgbouncer, 6543) adds per-query latency; the 5s default
    // interactive-transaction timeout is too tight for multi-write transitions.
    transactionOptions: { timeout: 30_000, maxWait: 10_000 },
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
