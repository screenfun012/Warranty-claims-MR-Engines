/**
 * POST /api/claims/[id]/unlock
 * SUPER_ADMIN: odključa bilo koju. ADMIN/OPERATOR: samo svoje (assignedToId === current user).
 */

import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db/prisma";
import { requirePermission, createPermissionError, PERMISSIONS } from "@/lib/auth/permissions";
import { isSuperAdmin } from "@/lib/auth/permissions";
import { getSession } from "@/lib/auth/get-session";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const prisma = await getPrisma();
    await requirePermission(PERMISSIONS.CLAIMS_UNLOCK);

    const { id } = await params;

    const claim = await prisma.claim.findUnique({
      where: { id },
    });

    if (!claim) {
      return NextResponse.json(
        { error: "Claim not found" },
        { status: 404 }
      );
    }

    const userIsSuperAdmin = await isSuperAdmin();
    if (!userIsSuperAdmin) {
      const session = await getSession();
      const sessionEmail = (session?.user as { email?: string })?.email;
      let currentUserId: string | null = null;
      if (sessionEmail) {
        const dbUser = await prisma.user.findUnique({
          where: { email: sessionEmail },
          select: { id: true },
        });
        currentUserId = dbUser?.id ?? null;
      }
      if (claim.assignedToId !== currentUserId) {
        return NextResponse.json(
          { error: "Možete odključati samo reklamacije dodeljene vama." },
          { status: 403 }
        );
      }
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


