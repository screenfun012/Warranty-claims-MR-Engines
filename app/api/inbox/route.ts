/**
 * API route for inbox (email threads)
 * GET /api/inbox - List all email threads (VIEWER+)
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requirePermission, createPermissionError, PERMISSIONS } from "@/lib/auth/permissions";

export async function GET() {
  try {
    // VIEWER+ can read inbox
    await requirePermission(PERMISSIONS.INBOX_READ);
    
    const threads = await prisma.emailThread.findMany({
      include: {
        claim: {
          select: {
            id: true,
            claimCodeRaw: true,
          },
        },
        messages: {
          select: {
            id: true,
            date: true,
            from: true,
          },
          orderBy: {
            date: "desc",
          },
          take: 1,
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    return NextResponse.json({ threads });
  } catch (error) {
    console.error("Error fetching inbox:", error);
    const permError = createPermissionError(error);
    if (permError.status !== 500) {
      return NextResponse.json({ error: permError.message }, { status: permError.status });
    }
    return NextResponse.json(
      { error: "Failed to fetch inbox" },
      { status: 500 }
    );
  }
}

