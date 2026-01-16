/**
 * Prisma client singleton
 * Use this to access the database throughout the application
 * 
 * Local development: Uses SQLite (file:./dev.db)
 * Production (Vercel): Uses Turso (libsql://)
 */

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaPromise: Promise<PrismaClient> | undefined;
};

// Check if we're using Turso
const isTurso = (process.env.DATABASE_URL || "").startsWith("libsql://");

// Create Prisma client - async for Turso, sync for SQLite
async function createPrismaClient(): Promise<PrismaClient> {
  if (isTurso) {
    // Dynamically import Turso adapter only when needed
    const { PrismaLibSQL } = await import("@prisma/adapter-libsql");
    const { createClient } = await import("@libsql/client");
    
    const libsql = createClient({
      url: process.env.DATABASE_URL!,
    });
    
    const adapter = new PrismaLibSQL(libsql);
    
    return new PrismaClient({
      adapter,
      log: ["error"],
    });
  }
  
  // Local SQLite
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });
}

// For local development (SQLite), export sync client
// For Turso, we need async initialization
let prismaClient: PrismaClient | undefined;

if (!isTurso) {
  // SQLite - synchronous initialization
  prismaClient = globalForPrisma.prisma ?? new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });
  
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prismaClient;
  }
}

// Export for use in API routes (only for SQLite, use getPrisma() for Turso)
export const prisma: PrismaClient | undefined = prismaClient;

// Export async getter for Turso compatibility (works for both SQLite and Turso)
export async function getPrisma(): Promise<PrismaClient> {
  // If using SQLite and we have a client, return it
  if (!isTurso && prismaClient) {
    return prismaClient;
  }
  
  // For Turso or if SQLite client not initialized yet
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma;
  }
  
  if (!globalForPrisma.prismaPromise) {
    globalForPrisma.prismaPromise = createPrismaClient();
  }
  
  const client = await globalForPrisma.prismaPromise;
  globalForPrisma.prisma = client;
  return client;
}

