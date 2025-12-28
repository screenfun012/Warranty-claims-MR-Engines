/**
 * Environment variable configuration and validation
 * All configuration must be via environment variables (12-factor style)
 * Email config can also come from database (EmailConfig model) - use getEmailConfig() for that
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

  // Email (IMAP) - optional, can be empty if email sync is disabled
  // Note: For runtime config from database, use getEmailConfig() from envLoader.ts
  IMAP_HOST: getEnv("IMAP_HOST", ""),
  IMAP_PORT: getEnvNumber("IMAP_PORT", 993),
  IMAP_USER: getEnv("IMAP_USER", ""),
  IMAP_PASS: getEnv("IMAP_PASS", ""),
  IMAP_TLS: getEnvBoolean("IMAP_TLS", true),

  // Email (SMTP) - optional, can be empty if email sending is not needed
  // Note: For runtime config from database, use getEmailConfig() from envLoader.ts
  SMTP_HOST: getEnv("SMTP_HOST", ""),
  SMTP_PORT: getEnvNumber("SMTP_PORT", 587),
  SMTP_USER: getEnv("SMTP_USER", ""),
  SMTP_PASS: getEnv("SMTP_PASS", ""),
  SMTP_TLS: getEnvBoolean("SMTP_TLS", true),

  // File storage
  FILE_ROOT_PATH: getEnv("FILE_ROOT_PATH", "./storage"),

  // Translation
  TRANSLATION_PROVIDER: getEnv("TRANSLATION_PROVIDER", "none"),
  TRANSLATION_API_KEY: getEnv("TRANSLATION_API_KEY", ""),
  TRANSLATION_BASE_URL: getEnv("TRANSLATION_BASE_URL", ""),
  TRANSLATION_MODEL: getEnv("TRANSLATION_MODEL", ""),

  // Mail sync
  MAIL_SYNC_ENABLED: getEnvBoolean("MAIL_SYNC_ENABLED", true),
  MAIL_SYNC_INTERVAL_SECONDS: getEnvNumber("MAIL_SYNC_INTERVAL_SECONDS", 300),
  MAIL_SYNC_MAX_MESSAGES_PER_RUN: getEnvNumber("MAIL_SYNC_MAX_MESSAGES_PER_RUN", 50),
  MAIL_SYNC_USE_IDLE: getEnvBoolean("MAIL_SYNC_USE_IDLE", true), // Use IMAP IDLE for real-time notifications
};
