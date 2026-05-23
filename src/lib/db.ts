import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

function makePrisma() {
  const url = process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL;
  const authToken =
    process.env.TURSO_AUTH_TOKEN ?? process.env.LIBSQL_DATABASE_TOKEN;

  if (!url) {
    throw new Error("Missing database URL. Set TURSO_DATABASE_URL or DATABASE_URL.");
  }

  const adapter = new PrismaLibSql({
    url,
    ...(authToken ? { authToken } : {}),
  });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const db = globalForPrisma.prisma ?? makePrisma();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
