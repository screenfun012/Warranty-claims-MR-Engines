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
    const adapterModule = await import("@prisma/adapter-libsql");
    
    // PrismaLibSql is a named export (note: lowercase 's' in Sql)
    const PrismaLibSql = (adapterModule as any).PrismaLibSql || (adapterModule as any).PrismaLibSQL;
    if (!PrismaLibSql) {
      throw new Error("PrismaLibSql not found in @prisma/adapter-libsql");
    }
    
    // Parse DATABASE_URL to extract URL and authToken
    // Turso URL format: libsql://db-name-username.turso.io?authToken=token
    const dbUrl = process.env.DATABASE_URL;
    
    if (!dbUrl) {
      throw new Error("DATABASE_URL environment variable is not set");
    }
    
    if (!dbUrl.startsWith("libsql://")) {
      throw new Error(`DATABASE_URL must start with "libsql://", got: ${dbUrl.substring(0, 20)}...`);
    }
    
    let url: string;
    let authToken: string | undefined;
    
    try {
      const urlObj = new URL(dbUrl);
      authToken = urlObj.searchParams.get("authToken") || undefined;
      // Reconstruct URL without query params
      url = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;
      
      // Validate that we have a valid URL
      if (!url || url === "libsql://" || url === "libsql:///") {
        throw new Error(`Invalid URL after parsing: ${url}`);
      }
    } catch (error) {
      // Fallback: if URL parsing fails, use the URL as-is
      // This handles cases where URL might already be in correct format
      url = dbUrl;
      // Try to extract authToken manually if present
      const tokenMatch = dbUrl.match(/[?&]authToken=([^&]+)/);
      authToken = tokenMatch ? tokenMatch[1] : undefined;
      
      // Remove authToken from URL if we extracted it
      if (authToken) {
        url = dbUrl.replace(/[?&]authToken=[^&]*/, "");
      }
      
      // Validate URL
      if (!url || url === "libsql://" || url === "libsql:///") {
        throw new Error(`Invalid DATABASE_URL format. Expected: libsql://host.turso.io?authToken=token, got: ${dbUrl.substring(0, 50)}...`);
      }
    }
    
    // Validate that we have a valid URL before creating client
    if (!url || url === "undefined") {
      throw new Error(`Failed to parse DATABASE_URL. URL is undefined. Original: ${dbUrl.substring(0, 50)}...`);
    }
    
    // Create libsql client first
    const { createClient } = await import("@libsql/client");
    const libsqlClient = createClient({
      url: url,
      authToken: authToken,
    });
    
    // PrismaLibSql is a factory - need to call connect() to get the adapter
    // Pass the libsql client to the factory
    const adapterFactory = new PrismaLibSql(libsqlClient);
    
    // Connect to get the actual adapter
    const adapter = await adapterFactory.connect();
    
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
let prismaClient: PrismaClient;

if (!isTurso) {
  // SQLite - synchronous initialization
  prismaClient = globalForPrisma.prisma ?? new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });
  
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prismaClient;
  }
} else {
  // For Turso, create a dummy client that will throw if used directly
  // This ensures TypeScript doesn't complain, but runtime will use getPrisma()
  prismaClient = {} as PrismaClient;
}

// Export for use in API routes (works for SQLite, but for Turso use getPrisma() instead)
// Note: For Turso, this will be undefined at runtime, so always use getPrisma() for Turso
export const prisma: PrismaClient = prismaClient;

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

