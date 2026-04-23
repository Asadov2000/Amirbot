import { PrismaClient, type Prisma } from "@prisma/client";

const globalForPrisma = globalThis as typeof globalThis & {
  __amirPrisma?: PrismaClient;
};

export function createPrismaClient(options: Prisma.PrismaClientOptions = {}) {
  return new PrismaClient({
    log: options.log ?? (process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"]),
    ...options
  });
}

export const prisma = globalForPrisma.__amirPrisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__amirPrisma = prisma;
}

export type DbClient = PrismaClient | Prisma.TransactionClient;
