/**
 * API route for managing a single department
 * DELETE /api/admin/departments/[id] - Delete department (ADMIN+ only, cannot delete system departments)
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
    // Only ADMIN+ can delete departments
    await requireMinimumRole(ROLES.ADMIN);

    const { id } = await params;

    const department = await prisma.department.findUnique({
      where: { id },
    });

    if (!department) {
      return NextResponse.json(
        { error: "Department not found" },
        { status: 404 }
      );
    }

    if (department.isSystem) {
      return NextResponse.json(
        { error: "Cannot delete system department" },
        { status: 400 }
      );
    }

    // Check if any claims are using this department
    const claimsUsingDepartment = await prisma.claim.count({
      where: { faultDepartmentId: id },
    });

    if (claimsUsingDepartment > 0) {
      return NextResponse.json(
        { error: `Cannot delete department: ${claimsUsingDepartment} claim(s) are using it` },
        { status: 400 }
      );
    }

    await prisma.department.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting department:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete department" },
      { status: 500 }
    );
  }
}
