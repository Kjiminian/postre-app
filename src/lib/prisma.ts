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

const globalForPrisma = global as unknown as { prisma: any };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClientClass({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
