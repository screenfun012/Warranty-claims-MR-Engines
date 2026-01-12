/**
 * POST /api/claims/[id]/unlock
 * Unlock a claim (super admin only)
 * This allows editing of closed/locked claims
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { isSuperAdmin } from "@/lib/auth/permissions";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Get user email from header (X-User-Email)
    const userEmail = request.headers.get("X-User-Email");
    
    // Check if user is super admin
    if (!isSuperAdmin(userEmail)) {
      return NextResponse.json(
        { error: "Unauthorized: Super admin access required" },
        { status: 403 }
      );
    }

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
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to unlock claim: ${errorMessage}` },
      { status: 500 }
    );
  }
}


