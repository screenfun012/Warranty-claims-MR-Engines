/**
 * Prisma client singleton
 * Use this to access the database throughout the application
 * 
 * Local development: Uses SQLite (file:./dev.db)
 * Production (Vercel): Uses Turso (libsql://)
 * 
 * Official Turso pattern: new PrismaLibSQL({ url, authToken })
 * URL and authToken should be separate environment variables:
 * - TURSO_DATABASE_URL (or DATABASE_URL as fallback)
 * - TURSO_AUTH_TOKEN (or DATABASE_AUTH_TOKEN as fallback)
 */

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaPromise: Promise<PrismaClient> | undefined;
};

// Check if we're using Turso
// Support both TURSO_DATABASE_URL (recommended) and DATABASE_URL (fallback)
const isTurso = 
  process.env.USE_TURSO === "true" || 
  !!process.env.TURSO_DATABASE_URL ||
  (process.env.DATABASE_URL || "").startsWith("libsql://");

// Helper to require environment variable
function requireEnv(name: string, value?: string): string {
  const v = value?.trim();
  if (!v) {
    throw new Error(`[Prisma] Missing required environment variable: ${name}`);
  }
  return v;
}

// Initialize Prisma client - async for Turso (needs connect()), sync for SQLite
async function initializePrismaAsync(): Promise<PrismaClient> {
  if (isTurso) {
    // Get URL - prefer TURSO_DATABASE_URL, fallback to DATABASE_URL
    const url = requireEnv(
      "TURSO_DATABASE_URL (or DATABASE_URL)",
      process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL
    );

    // Extract URL if it contains authToken in query string (backward compatibility)
    let cleanUrl = url;
    if (url.includes("?authToken=") || url.includes("&authToken=")) {
      // Remove authToken from URL if present
      cleanUrl = url.split("?")[0].split("&")[0];
    }

    // Get authToken - prefer TURSO_AUTH_TOKEN, fallback to DATABASE_AUTH_TOKEN or extract from URL
    let authToken: string | undefined = 
      process.env.TURSO_AUTH_TOKEN?.trim() || 
      process.env.DATABASE_AUTH_TOKEN?.trim();

    // If not found in env vars, try to extract from DATABASE_URL (backward compatibility)
    if (!authToken && url.includes("authToken=")) {
      const tokenMatch = url.match(/[?&]authToken=([^&]+)/);
      authToken = tokenMatch ? tokenMatch[1] : undefined;
    }

    // Require authToken
    authToken = requireEnv("TURSO_AUTH_TOKEN (or DATABASE_AUTH_TOKEN)", authToken);

    // Validate URL format
    if (!cleanUrl.startsWith("libsql://")) {
      throw new Error(`[Prisma] TURSO_DATABASE_URL must start with "libsql://", got: ${cleanUrl.substring(0, 50)}`);
    }

    console.log(`[Prisma] Initializing Turso connection - Host: ${cleanUrl.substring(0, 50)}..., HasToken: ${!!authToken}`);

    // Dynamically import PrismaLibSQL adapter
    // For @prisma/adapter-libsql@5.20.0, use PrismaLibSQL (with capital SQL)
    const adapterModule = await import("@prisma/adapter-libsql");
    const PrismaLibSQL = adapterModule.PrismaLibSQL;
    
    if (!PrismaLibSQL) {
      throw new Error("[Prisma] PrismaLibSQL not found in @prisma/adapter-libsql. Available exports: " + Object.keys(adapterModule).join(", "));
    }
    
    // For Prisma 5.20.0, create libsql client first, then wrap in adapter
    const { createClient } = await import("@libsql/client");
    const libsqlClient = createClient({
      url: cleanUrl,
      authToken: authToken,
    });
    
    // Wrap libsql client in PrismaLibSQL adapter (Prisma 5.20 pattern)
    const adapter = new PrismaLibSQL(libsqlClient);

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

// Initialize Prisma client - sync wrapper
function initializePrisma(): PrismaClient {
  if (!isTurso) {
    // Local SQLite - synchronous
    return new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
    });
  }
  
  // For Turso, we need async initialization
  // This will be handled by getPrisma() function
  // Return a dummy client that will throw if used directly
  return {} as PrismaClient;
}

// Export singleton Prisma client (works for SQLite, for Turso use getPrisma())
export const prisma = initializePrisma();

// Export async getter for Turso compatibility (works for both SQLite and Turso)
export async function getPrisma(): Promise<PrismaClient> {
  if (!isTurso) {
    // SQLite - return sync client
    if (globalForPrisma.prisma) {
      return globalForPrisma.prisma;
    }
    const client = new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
    });
    if (process.env.NODE_ENV !== "production") {
      globalForPrisma.prisma = client;
    }
    return client;
  }
  
  // Turso - async initialization
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma;
  }
  
  if (!globalForPrisma.prismaPromise) {
    globalForPrisma.prismaPromise = initializePrismaAsync();
  }
  
  const client = await globalForPrisma.prismaPromise;
  globalForPrisma.prisma = client;
  return client;
}
