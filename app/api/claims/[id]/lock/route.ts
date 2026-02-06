/**
 * POST /api/claims/[id]/lock
 * Lock a claim (SUPER_ADMIN only)
 * This makes the claim read-only for non-SUPER_ADMIN users
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
    // Only SUPER_ADMIN can lock claims
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

    // Lock the claim by setting isLocked = true
    const updatedClaim = await prisma.claim.update({
      where: { id },
      data: {
        isLocked: true,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ 
      success: true,
      message: "Claim locked successfully",
      claim: {
        id: updatedClaim.id,
        status: updatedClaim.status,
        isLocked: updatedClaim.isLocked,
      }
    });
  } catch (error) {
    console.error("Error locking claim:", error);
    const permError = createPermissionError(error);
    if (permError.status !== 500) {
      return NextResponse.json({ error: permError.message }, { status: permError.status });
    }
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to lock claim: ${errorMessage}` },
      { status: 500 }
    );
  }
}
