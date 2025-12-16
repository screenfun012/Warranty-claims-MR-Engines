import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

/**
 * Mark an email thread as viewed/opened
 * POST /api/inbox/[id]/mark-viewed
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await prisma.emailThread.update({
      where: { id },
      data: {
        viewedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error marking thread as viewed:", error);
    return NextResponse.json(
      { error: "Failed to mark thread as viewed" },
      { status: 500 }
    );
  }
}

