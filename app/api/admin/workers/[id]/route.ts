/**
 * API routes for individual worker management (SUPER_ADMIN only)
 * DELETE /api/admin/workers/[id] - Delete worker
 */

import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db/prisma";
import { requireMinimumRole } from "@/lib/auth/permissions";
import { ROLES } from "@/lib/auth/roles";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const prisma = await getPrisma();
    // Only SUPER_ADMIN can delete workers
    await requireMinimumRole(ROLES.SUPER_ADMIN);

    const { id } = await params;

    await prisma.predefinedWorker.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting worker:", error);
    if (error.code === "P2025") {
      return NextResponse.json(
        { error: "Worker not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "Failed to delete worker" },
      { status: 500 }
    );
  }
}
