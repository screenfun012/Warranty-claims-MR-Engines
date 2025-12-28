/**
 * Test IMAP IDLE connection
 * GET /api/admin/mail/test-idle - Test if IDLE can be started
 * POST /api/admin/mail/test-idle - Try to start IDLE and return detailed results
 */

import { NextResponse } from "next/server";
import { getImapIdleClient } from "@/lib/email/imapIdleClient";
import { getEmailConfig } from "@/lib/config/envLoader";
import { env } from "@/lib/config/env";
import { getImapClient } from "@/lib/email/imapClient";

export async function GET() {
  try {
    // Check if IDLE is enabled
    const useIdle = env.MAIL_SYNC_USE_IDLE;
    
    // Check email config
    const dbConfig = await getEmailConfig();
    const imapHost = dbConfig?.imapHost || env.IMAP_HOST;
    const imapUser = dbConfig?.imapUser || env.IMAP_USER;
    
    if (!imapHost || !imapUser) {
      return NextResponse.json({
        success: false,
        error: "Email not configured",
        details: {
          useIdle,
          hasHost: !!imapHost,
          hasUser: !!imapUser,
        },
      });
    }

    // Try to get IDLE client status
    const idleClient = getImapIdleClient();
    const isIdleActive = idleClient.isIdleActive();
    const reconnectAttempts = idleClient.getReconnectAttempts();

    return NextResponse.json({
      success: true,
      config: {
        useIdle,
        imapHost,
        imapUser: imapUser.substring(0, 3) + "***", // Mask email
        mailSyncEnabled: env.MAIL_SYNC_ENABLED,
      },
      status: {
        isIdleActive,
        reconnectAttempts,
      },
      message: isIdleActive 
        ? "IDLE is currently active" 
        : useIdle 
          ? "IDLE is enabled but not active (may have fallen back to polling)" 
          : "IDLE is disabled, using polling mode",
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    console.log("[Test IDLE] Starting IDLE test...");
    
    // Check if IDLE is enabled
    const useIdle = env.MAIL_SYNC_USE_IDLE;
    
    if (!useIdle) {
      return NextResponse.json({
        success: false,
        error: "IDLE is disabled. Set MAIL_SYNC_USE_IDLE=true to enable.",
      });
    }

    // Check email config
    const dbConfig = await getEmailConfig();
    const imapHost = dbConfig?.imapHost || env.IMAP_HOST;
    const imapUser = dbConfig?.imapUser || env.IMAP_USER;
    
    if (!imapHost || !imapUser) {
      return NextResponse.json({
        success: false,
        error: "Email not configured",
      });
    }

    // Test 1: Try to create IMAP client
    let clientTest = { success: false, error: "" };
    try {
      const client = await getImapClient();
      await client.connect();
      clientTest = { success: true, error: "" };
      await client.logout();
    } catch (error) {
      clientTest = {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }

    // Test 2: Try to start IDLE
    let idleTest = { success: false, error: "", isActive: false };
    try {
      const idleClient = getImapIdleClient();
      
      // Try to start IDLE with a timeout
      const startPromise = idleClient.start(async () => {
        console.log("[Test IDLE] New message callback triggered");
      });
      
      // Wait up to 10 seconds for IDLE to start
      await Promise.race([
        startPromise,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error("IDLE start timeout after 10 seconds")), 10000)
        ),
      ]);

      // Check if IDLE is active
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
      const isActive = idleClient.isIdleActive();
      
      idleTest = {
        success: isActive,
        error: isActive ? "" : "IDLE started but is not active",
        isActive,
      };
    } catch (error) {
      idleTest = {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        isActive: false,
      };
    }

    return NextResponse.json({
      success: clientTest.success && idleTest.success,
      tests: {
        imapConnection: clientTest,
        idleStart: idleTest,
      },
      config: {
        useIdle,
        imapHost,
        imapUser: imapUser.substring(0, 3) + "***",
      },
      message: clientTest.success && idleTest.success
        ? "IDLE test successful - IDLE is active and listening for new emails"
        : clientTest.success
          ? `IDLE test failed: ${idleTest.error}`
          : `IMAP connection failed: ${clientTest.error}`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

