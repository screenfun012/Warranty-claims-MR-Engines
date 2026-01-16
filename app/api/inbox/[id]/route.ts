/**
 * API route for individual email thread
 * GET /api/inbox/[id] - Get thread details with all messages (VIEWER+)
 */

import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db/prisma";
import { requirePermission, createPermissionError, PERMISSIONS } from "@/lib/auth/permissions";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const prisma = await getPrisma();
    // VIEWER+ can read inbox
    await requirePermission(PERMISSIONS.INBOX_READ);
    
    const { id } = await params;

    const thread = await prisma.emailThread.findUnique({
      where: { id },
      include: {
        claim: {
          select: {
            id: true,
            claimCodeRaw: true,
          },
        },
        messages: {
          include: {
            attachments: true,
          },
          orderBy: {
            date: "asc",
          },
        },
      },
    });

    if (!thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    return NextResponse.json({ thread });
  } catch (error) {
    console.error("Error fetching thread:", error);
    const permError = createPermissionError(error);
    if (permError.status !== 500) {
      return NextResponse.json({ error: permError.message }, { status: permError.status });
    }
    return NextResponse.json(
      { error: "Failed to fetch thread" },
      { status: 500 }
    );
  }
}

