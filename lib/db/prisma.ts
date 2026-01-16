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
      throw new Error("DATABASE_URL environment variable is not set. Please set it in Vercel Environment Variables.");
    }
    
    if (!dbUrl.startsWith("libsql://")) {
      throw new Error(`DATABASE_URL must start with "libsql://", got: ${dbUrl.substring(0, 50)}`);
    }
    
    // Parse URL to extract base URL and authToken
    let url: string = "";
    let authToken: string | undefined;
    
    try {
      const urlObj = new URL(dbUrl);
      
      // Extract authToken from query params
      authToken = urlObj.searchParams.get("authToken") || undefined;
      
      // Build base URL: protocol + host + pathname (without query params)
      const host = urlObj.host;
      const pathname = urlObj.pathname || "";
      
      if (!host) {
        throw new Error(`Invalid DATABASE_URL: missing host. Full URL: ${dbUrl.substring(0, 100)}`);
      }
      
      url = `libsql://${host}${pathname}`;
      
      // Validate URL
      if (!url || url === "libsql://" || url === "libsql:///") {
        throw new Error(`Invalid URL after parsing. Host: ${host}, Pathname: ${pathname}`);
      }
      
      // Log for debugging (only first few chars of token for security)
      console.log(`[Prisma] Parsed DATABASE_URL - Host: ${host}, HasToken: ${!!authToken}, TokenPreview: ${authToken ? authToken.substring(0, 10) + '...' : 'none'}`);
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[Prisma] Error parsing DATABASE_URL: ${errorMsg}`);
      console.error(`[Prisma] DATABASE_URL value (first 100 chars): ${dbUrl.substring(0, 100)}`);
      
      // Fallback: try to extract manually
      const tokenMatch = dbUrl.match(/[?&]authToken=([^&]+)/);
      authToken = tokenMatch ? tokenMatch[1] : undefined;
      
      // Try to extract base URL manually
      const urlMatch = dbUrl.match(/^(libsql:\/\/[^?&]+)/);
      if (urlMatch) {
        url = urlMatch[1];
      } else {
        // Last resort: use full URL without query params
        url = dbUrl.split('?')[0];
      }
      
      if (!url || url === "undefined" || !url.startsWith("libsql://")) {
        throw new Error(`Failed to parse DATABASE_URL: ${errorMsg}. DATABASE_URL format should be: libsql://host.turso.io?authToken=token. Got: ${dbUrl.substring(0, 80)}`);
      }
      
      console.log(`[Prisma] Using fallback parsing - URL: ${url.substring(0, 50)}..., HasToken: ${!!authToken}`);
    }
    
    // Final validation
    if (!url || url === "undefined" || !url.startsWith("libsql://")) {
      throw new Error(`Invalid URL after parsing: "${url}". Original DATABASE_URL: ${dbUrl.substring(0, 80)}`);
    }
    
    if (!authToken) {
      console.warn("[Prisma] WARNING: No authToken found in DATABASE_URL. This may cause authentication errors.");
    }
    
    // Create libsql client
    const { createClient } = await import("@libsql/client");
    
    try {
      const libsqlClient = createClient({
        url: url,
        authToken: authToken,
      });
      
      console.log(`[Prisma] Successfully created libsql client for: ${url.substring(0, 50)}...`);
      
      // PrismaLibSql is a factory - need to call connect() to get the adapter
      // Pass the libsql client to the factory
      const adapterFactory = new PrismaLibSql(libsqlClient);
      
      // Connect to get the actual adapter
      const adapter = await adapterFactory.connect();
      
      console.log(`[Prisma] Successfully connected adapter`);
      
      return new PrismaClient({
        adapter,
        log: ["error"],
      });
    } catch (clientError) {
      const clientErrorMsg = clientError instanceof Error ? clientError.message : String(clientError);
      throw new Error(`Failed to create libsql client: ${clientErrorMsg}. URL: ${url.substring(0, 50)}..., HasToken: ${!!authToken}`);
    }
    
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

