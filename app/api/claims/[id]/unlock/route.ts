/**
 * POST /api/claims/[id]/unlock
 * Unlock a claim (SUPER_ADMIN only)
 * This allows editing of closed/locked claims
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requirePermission, createPermissionError, PERMISSIONS } from "@/lib/auth/permissions";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Only SUPER_ADMIN can unlock claims
    await requirePermission(PERMISSIONS.CLAIMS_UNLOCK);
    
    const { id } = await params;

    // Verify claim exists
    const claim = await prisma.claim.findUnique({
      where: { id },
    });

    if (!claim) {
      return NextResponse.json(
        { error: "Claim not found" },
        { status: 404 }
      );
    }

    // For now, unlocking means allowing edits even if status is CLOSED
    // We can add a separate "locked" field later if needed
    // For now, we just return success - the frontend will handle allowing edits

    return NextResponse.json({ 
      success: true,
      message: "Claim unlocked successfully",
      claim: {
        id: claim.id,
        status: claim.status,
      }
    });
  } catch (error) {
    console.error("Error unlocking claim:", error);
    const permError = createPermissionError(error);
    if (permError.status !== 500) {
      return NextResponse.json({ error: permError.message }, { status: permError.status });
    }
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to unlock claim: ${errorMessage}` },
      { status: 500 }
    );
  }
}


