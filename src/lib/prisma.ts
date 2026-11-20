// Cliente Prisma — Singleton para K_Sweet
let PrismaClientClass: any;

try {
  // Primero intentar cargar el cliente generado localmente
  const generated = require("@/generated/client");
  PrismaClientClass = generated.PrismaClient;
} catch {
  try {
    const pkg = require("@prisma/client");
    PrismaClientClass = pkg.PrismaClient;
  } catch {
    PrismaClientClass = class MockPrismaClient {};
  }
}

const globalForPrisma = global as unknown as { prisma: any; sqliteWalInitialized?: boolean };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClientClass({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (!globalForPrisma.sqliteWalInitialized && typeof prisma?.$executeRawUnsafe === "function") {
  globalForPrisma.sqliteWalInitialized = true;
  Promise.resolve()
    .then(() => prisma.$executeRawUnsafe("PRAGMA journal_mode = WAL;"))
    .then(() => prisma.$executeRawUnsafe("PRAGMA busy_timeout = 5000;"))
    .catch(() => {
      // Silencioso en entornos sin BD inicializada (p. ej. build estático)
    });
}

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
