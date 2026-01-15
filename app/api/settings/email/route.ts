/**
 * API route for email configuration (read-only)
 * GET /api/settings/email - Get email config from environment variables
 * 
 * Email credentials are stored in .env file, not in database.
 */

import { NextResponse } from "next/server";
import { getEmailConfig, isEmailConfigured } from "@/lib/config/envLoader";
import { requirePermission, createPermissionError, PERMISSIONS } from "@/lib/auth/permissions";

export async function GET() {
  try {
    // ADMIN+ can view settings
    await requirePermission(PERMISSIONS.SETTINGS_READ);
    
    const config = getEmailConfig();
    const configured = isEmailConfigured();

    // Return config with masked passwords
    return NextResponse.json({
      config: {
        imapServer: config.imapServer,
        imapPort: config.imapPort,
        imapUserEmail: config.imapUserEmail,
        imapUserPass: config.imapUserPass ? "••••••••" : "",
        imapTls: config.imapTls,
        smtpServer: config.smtpServer,
        smtpPort: config.smtpPort,
        smtpUserEmail: config.smtpUserEmail,
        smtpUserPass: config.smtpUserPass ? "••••••••" : "",
        smtpTls: config.smtpTls,
      },
      configured,
      readOnly: true, // Email config is stored in .env file
    });
  } catch (error) {
    console.error("Error fetching email config:", error);
    const permError = createPermissionError(error);
    if (permError.status !== 500) {
      return NextResponse.json({ error: permError.message }, { status: permError.status });
    }
    return NextResponse.json(
      { error: "Failed to fetch email config" },
      { status: 500 }
    );
  }
}

