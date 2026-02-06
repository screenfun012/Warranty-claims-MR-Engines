/**
 * POST /api/claims/[id]/unlock
 * Unlock a claim (SUPER_ADMIN only)
 * This allows editing of closed/locked claims
 */

import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db/prisma";
import { requirePermission, createPermissionError, PERMISSIONS } from "@/lib/auth/permissions";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const prisma = await getPrisma();
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

    // Unlock the claim by setting isLocked = false
    // Note: This doesn't change the status, just unlocks it for editing
    const updatedClaim = await prisma.claim.update({
      where: { id },
      data: {
        isLocked: false,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ 
      success: true,
      message: "Claim unlocked successfully",
      claim: {
        id: updatedClaim.id,
        status: updatedClaim.status,
        isLocked: updatedClaim.isLocked,
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


