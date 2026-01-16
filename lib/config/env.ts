/**
 * Environment variable configuration and validation
 * All configuration must be via environment variables (12-factor style)
 */

function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (value !== undefined && value !== null && value !== "") {
    return value;
  }
  if (defaultValue !== undefined) {
    return defaultValue;
  }
  throw new Error(`Missing required environment variable: ${key}`);
}

function getEnvBoolean(key: string, defaultValue: boolean = false): boolean {
  const value = process.env[key];
  if (!value) return defaultValue;
  return value.toLowerCase() === "true" || value === "1";
}

function getEnvNumber(key: string, defaultValue?: number): number {
  const value = process.env[key];
  if (value !== undefined && value !== null && value !== "") {
    return parseInt(value, 10);
  }
  if (defaultValue !== undefined) {
    return defaultValue;
  }
  throw new Error(`Missing required environment variable: ${key}`);
}

export const env = {
  // Database
  DATABASE_URL: getEnv("DATABASE_URL", "file:./dev.db"),

  // Email (IMAP) - for receiving emails
  IMAP_SERVER: getEnv("IMAP_SERVER", ""),
  IMAP_PORT: getEnvNumber("IMAP_PORT", 993),
  IMAP_USER_EMAIL: getEnv("IMAP_USER_EMAIL", ""),
  IMAP_USER_PASS: getEnv("IMAP_USER_PASS", ""),
  IMAP_TLS: getEnvBoolean("IMAP_TLS", true),

  // Email (SMTP) - for sending emails
  SMTP_SERVER: getEnv("SMTP_SERVER", ""),
  SMTP_PORT: getEnvNumber("SMTP_PORT", 465),
  SMTP_USER_EMAIL: getEnv("SMTP_USER_EMAIL", ""),
  SMTP_USER_PASS: getEnv("SMTP_USER_PASS", ""),
  SMTP_TLS: getEnvBoolean("SMTP_TLS", true),

  // File storage
  FILE_ROOT_PATH: getEnv("FILE_ROOT_PATH", "./storage"),
  // Vercel Blob (optional - if set, uses Blob instead of filesystem)
  BLOB_READ_WRITE_TOKEN: getEnv("BLOB_READ_WRITE_TOKEN", ""),
  // WebDAV (optional - if set, uses WebDAV instead of filesystem/blob)
  // Priority: WebDAV > Blob > Filesystem
  WEBDAV_URL: getEnv("WEBDAV_URL", ""),
  WEBDAV_USERNAME: getEnv("WEBDAV_USERNAME", ""),
  WEBDAV_PASSWORD: getEnv("WEBDAV_PASSWORD", ""),
  WEBDAV_BASE_PATH: getEnv("WEBDAV_BASE_PATH", "/mr-engines-warranty"),

  // Translation
  TRANSLATION_PROVIDER: getEnv("TRANSLATION_PROVIDER", "none"),
  TRANSLATION_API_KEY: getEnv("TRANSLATION_API_KEY", ""),
  TRANSLATION_BASE_URL: getEnv("TRANSLATION_BASE_URL", ""),
  TRANSLATION_MODEL: getEnv("TRANSLATION_MODEL", ""),

  // Mail sync
  MAIL_SYNC_ENABLED: getEnvBoolean("MAIL_SYNC_ENABLED", true),
  MAIL_SYNC_INTERVAL_SECONDS: getEnvNumber("MAIL_SYNC_INTERVAL_SECONDS", 300),
  MAIL_SYNC_MAX_MESSAGES_PER_RUN: getEnvNumber("MAIL_SYNC_MAX_MESSAGES_PER_RUN", 50),
  MAIL_SYNC_USE_IDLE: getEnvBoolean("MAIL_SYNC_USE_IDLE", true),
};
