/**
 * Load environment variables from database (EmailConfig) or fallback to env vars
 * This allows runtime configuration via UI
 */

import { prisma } from "@/lib/db/prisma";

let cachedConfig: {
  imapHost?: string;
  imapPort?: number;
  imapUser?: string;
  imapPass?: string;
  imapTls?: boolean;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  smtpTls?: boolean;
} | null = null;

let cacheTimestamp = 0;
const CACHE_TTL = 60000; // 1 minute cache

/**
 * Get email configuration from database or env vars
 */
export async function getEmailConfig() {
  const now = Date.now();
  
  // Return cached config if still valid
  if (cachedConfig && (now - cacheTimestamp) < CACHE_TTL) {
    return cachedConfig;
  }

  try {
    const dbConfig = await prisma.emailConfig.findUnique({
      where: { id: "default" },
    });

    if (dbConfig) {
      // Always include passwords if they exist in database, regardless of rememberCredentials
      // The rememberCredentials flag only controls whether to save new passwords
      cachedConfig = {
        imapHost: dbConfig.imapHost || undefined,
        imapPort: dbConfig.imapPort || undefined,
        imapUser: dbConfig.imapUser || undefined,
        imapPass: dbConfig.imapPass || undefined, // Always use password if it exists
        imapTls: dbConfig.imapTls,
        smtpHost: dbConfig.smtpHost || undefined,
        smtpPort: dbConfig.smtpPort || undefined,
        smtpUser: dbConfig.smtpUser || undefined,
        smtpPass: dbConfig.smtpPass || undefined, // Always use password if it exists
        smtpTls: dbConfig.smtpTls,
      };
      cacheTimestamp = now;
      console.log("Email config loaded from database:", {
        imapHost: cachedConfig.imapHost,
        imapUser: cachedConfig.imapUser,
        hasImapPass: !!cachedConfig.imapPass,
        imapPassLength: cachedConfig.imapPass?.length || 0,
      });
      return cachedConfig;
    }
  } catch (error) {
    console.error("Error loading email config from database:", error);
  }

  // Fallback to env vars
  cachedConfig = null;
  return null;
}

/**
 * Clear the config cache (call after updating config)
 */
export function clearEmailConfigCache() {
  cachedConfig = null;
  cacheTimestamp = 0;
}

