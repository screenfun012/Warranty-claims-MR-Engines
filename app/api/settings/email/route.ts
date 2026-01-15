/**
 * API route for email configuration
 * GET /api/settings/email - Get email config (ADMIN+)
 * POST /api/settings/email - Save email config (SUPER_ADMIN only)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { clearEmailConfigCache } from "@/lib/config/envLoader";
import { requirePermission, createPermissionError, PERMISSIONS } from "@/lib/auth/permissions";

export async function GET() {
  try {
    // ADMIN+ can view settings
    await requirePermission(PERMISSIONS.SETTINGS_READ);
    
    const config = await prisma.emailConfig.findUnique({
      where: { id: "default" },
    });

    if (!config) {
      return NextResponse.json({ config: null });
    }

    // Return config, but mask passwords if they exist
    return NextResponse.json({
      config: {
        ...config,
        imapPass: config.imapPass ? "••••••••" : "",
        smtpPass: config.smtpPass ? "••••••••" : "",
      },
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

export async function POST(request: NextRequest) {
  try {
    // Only SUPER_ADMIN can update settings
    await requirePermission(PERMISSIONS.SETTINGS_UPDATE);
    
    const body = await request.json();
    const {
      imapHost,
      imapPort,
      imapUser,
      imapPass,
      imapTls,
      smtpHost,
      smtpPort,
      smtpUser,
      smtpPass,
      smtpTls,
      rememberCredentials,
    } = body;

    // If rememberCredentials is false, don't save passwords
    const dataToSave: any = {
      imapHost,
      imapPort: imapPort || 993,
      imapUser,
      imapTls: imapTls !== undefined ? imapTls : true,
      smtpHost,
      smtpPort: smtpPort || 587,
      smtpUser,
      smtpTls: smtpTls !== undefined ? smtpTls : true,
      rememberCredentials: rememberCredentials !== undefined ? rememberCredentials : true,
    };

    // Only save passwords if rememberCredentials is true and password is provided (not the masked value)
    if (rememberCredentials) {
      if (imapPass && imapPass !== "••••••••" && imapPass.trim() !== "") {
        dataToSave.imapPass = imapPass;
        console.log("Saving IMAP password (length:", imapPass.length, ")");
      } else if (imapPass === "••••••••" || imapPass === "") {
        // Keep existing password if masked value or empty
        console.log("Keeping existing IMAP password");
      }
      if (smtpPass && smtpPass !== "••••••••" && smtpPass.trim() !== "") {
        dataToSave.smtpPass = smtpPass;
        console.log("Saving SMTP password (length:", smtpPass.length, ")");
      } else if (smtpPass === "••••••••" || smtpPass === "") {
        // Keep existing password if masked value or empty
        console.log("Keeping existing SMTP password");
      }
    } else {
      // Clear passwords if not remembering
      dataToSave.imapPass = "";
      dataToSave.smtpPass = "";
      console.log("Not remembering credentials - clearing passwords");
    }

    const config = await prisma.emailConfig.upsert({
      where: { id: "default" },
      update: dataToSave,
      create: {
        id: "default",
        ...dataToSave,
      },
    });

    // Clear cache so new config is used immediately
    clearEmailConfigCache();

    return NextResponse.json({
      success: true,
      config: {
        ...config,
        imapPass: config.imapPass ? "••••••••" : "",
        smtpPass: config.smtpPass ? "••••••••" : "",
      },
    });
  } catch (error) {
    console.error("Error saving email config:", error);
    const permError = createPermissionError(error);
    if (permError.status !== 500) {
      return NextResponse.json({ error: permError.message }, { status: permError.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save email config" },
      { status: 500 }
    );
  }
}

