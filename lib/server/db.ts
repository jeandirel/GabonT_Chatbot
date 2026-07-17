import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export function db() {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL n’est pas configurée.");
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const client = new PrismaClient({ adapter });
  if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = client;
  return client;
}

export function hasDatabase() { return Boolean(process.env.DATABASE_URL); }
