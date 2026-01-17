/**
 * Debug endpoint to check email sync logs
 * GET /api/admin/mail/debug-logs
 */

import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db/prisma";
import { syncNewEmails } from "@/lib/email/mailSyncService";
import { isEmailConfigured } from "@/lib/config/envLoader";
import { env } from "@/lib/config/env";

export const maxDuration = 60;
export const runtime = 'nodejs';

export async function GET() {
  const logs: string[] = [];
  
  try {
    // Capture console logs
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;
    
    const capturedLogs: string[] = [];
    
    console.log = (...args: any[]) => {
      capturedLogs.push(`[LOG] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}`);
      originalLog(...args);
    };
    
    console.error = (...args: any[]) => {
      capturedLogs.push(`[ERROR] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}`);
      originalError(...args);
    };
    
    console.warn = (...args: any[]) => {
      capturedLogs.push(`[WARN] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}`);
      originalWarn(...args);
    };

    logs.push("=== EMAIL SYNC DEBUG ===");
    logs.push("");
    
    // 1. Check config
    logs.push("1. Configuration:");
    logs.push(`   MAIL_SYNC_ENABLED: ${env.MAIL_SYNC_ENABLED}`);
    logs.push(`   MAIL_SYNC_USE_IDLE: ${env.MAIL_SYNC_USE_IDLE}`);
    logs.push(`   MAIL_SYNC_MAX_MESSAGES_PER_RUN: ${env.MAIL_SYNC_MAX_MESSAGES_PER_RUN}`);
    logs.push(`   Email configured: ${isEmailConfigured()}`);
    logs.push("");
    
    // 2. Check database state
    logs.push("2. Database state:");
    try {
      const prisma = await getPrisma();
      const syncState = await prisma.mailSyncState.findUnique({
        where: { id: "default" },
      });
      
      if (syncState) {
        logs.push(`   Last UID: ${syncState.lastUid || "null"}`);
        logs.push(`   Last synced at: ${syncState.lastSyncedAt || "never"}`);
      } else {
        logs.push("   No sync state found");
      }
      
      const threadCount = await prisma.emailThread.count();
      const messageCount = await prisma.emailMessage.count();
      logs.push(`   Threads in DB: ${threadCount}`);
      logs.push(`   Messages in DB: ${messageCount}`);
    } catch (error) {
      logs.push(`   Error: ${error instanceof Error ? error.message : String(error)}`);
    }
    logs.push("");
    
    // 3. Try to sync
    logs.push("3. Attempting sync...");
    try {
      const result = await syncNewEmails();
      logs.push(`   Result: ${result.newMessages} new messages, ${result.newThreads} new threads`);
    } catch (error) {
      logs.push(`   Error: ${error instanceof Error ? error.message : String(error)}`);
      logs.push(`   Stack: ${error instanceof Error ? error.stack : "N/A"}`);
    }
    logs.push("");
    
    // 4. Show captured logs
    logs.push("4. Sync logs:");
    if (capturedLogs.length > 0) {
      capturedLogs.slice(-50).forEach(log => logs.push(`   ${log}`)); // Last 50 logs
    } else {
      logs.push("   No logs captured");
    }
    
    // Restore console
    console.log = originalLog;
    console.error = originalError;
    console.warn = originalWarn;
    
    return NextResponse.json({
      success: true,
      logs: logs,
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      logs: logs,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
