/**
 * API route for individual email thread
 * GET /api/inbox/[id] - Get thread details with all messages
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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
    return NextResponse.json(
      { error: "Failed to fetch thread" },
      { status: 500 }
    );
  }
}

