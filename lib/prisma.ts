import type { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import type { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@/app/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const tursoToken = process.env.TOKEN_DATABASE;

// Imports dynamiques : sur Vercel, TOKEN_DATABASE est toujours défini, donc la branche
// better-sqlite3 (module natif, jamais utilisable en serverless) n'est jamais chargée ni
// exécutée. À l'inverse en local sans token, @prisma/adapter-libsql n'est pas chargé.
let adapter: PrismaBetterSqlite3 | PrismaLibSql;
if (tursoToken) {
  const { PrismaLibSql } = await import("@prisma/adapter-libsql");
  adapter = new PrismaLibSql({ url: process.env.DATABASE_URL ?? "", authToken: tursoToken });
} else {
  const { PrismaBetterSqlite3 } = await import("@prisma/adapter-better-sqlite3");
  adapter = new PrismaBetterSqlite3({ url: "file:./dev.db" });
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
