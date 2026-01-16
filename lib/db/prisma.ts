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

// Initialize Prisma client
function initializePrisma(): PrismaClient {
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
    // Use the official pattern: new PrismaLibSQL({ url, authToken })
    // No need for createClient() or connect() - PrismaLibSQL handles it internally
    // Note: Using synchronous require for top-level initialization
    const adapterModule = require("@prisma/adapter-libsql");
    const PrismaLibSQL = adapterModule.PrismaLibSQL || adapterModule.PrismaLibSql;
    
    if (!PrismaLibSQL) {
      throw new Error("[Prisma] PrismaLibSQL not found in @prisma/adapter-libsql");
    }
    
    const adapter = new PrismaLibSQL({
      url: cleanUrl,
      authToken: authToken,
    });

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

// Export singleton Prisma client
export const prisma =
  globalForPrisma.prisma ??
  initializePrisma();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Export async getter for backward compatibility (works for both SQLite and Turso)
export async function getPrisma(): Promise<PrismaClient> {
  return prisma;
}
