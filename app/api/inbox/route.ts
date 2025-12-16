/**
 * API route for inbox (email threads)
 * GET /api/inbox - List all email threads
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
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
    return NextResponse.json(
      { error: "Failed to fetch inbox" },
      { status: 500 }
    );
  }
}

