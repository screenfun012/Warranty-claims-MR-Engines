/**
 * Email configuration helper
 * Returns email config from environment variables
 */

import { env } from "@/lib/config/env";

export interface EmailConfig {
  imapServer: string;
  imapPort: number;
  imapUserEmail: string;
  imapUserPass: string;
  imapTls: boolean;
  smtpServer: string;
  smtpPort: number;
  smtpUserEmail: string;
  smtpUserPass: string;
  smtpTls: boolean;
}

/**
 * Get email configuration from environment variables
 */
export function getEmailConfig(): EmailConfig {
  return {
    imapServer: env.IMAP_SERVER,
    imapPort: env.IMAP_PORT,
    imapUserEmail: env.IMAP_USER_EMAIL,
    imapUserPass: env.IMAP_USER_PASS,
    imapTls: env.IMAP_TLS,
    smtpServer: env.SMTP_SERVER,
    smtpPort: env.SMTP_PORT,
    smtpUserEmail: env.SMTP_USER_EMAIL,
    smtpUserPass: env.SMTP_USER_PASS,
    smtpTls: env.SMTP_TLS,
  };
}

/**
 * Check if email configuration is valid (all required fields set)
 */
export function isEmailConfigured(): boolean {
  const config = getEmailConfig();
  return !!(
    config.imapServer &&
    config.imapUserEmail &&
    config.imapUserPass &&
    config.smtpServer &&
    config.smtpUserEmail &&
    config.smtpUserPass
  );
}

