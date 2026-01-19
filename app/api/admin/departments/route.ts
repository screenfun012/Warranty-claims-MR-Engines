/**
 * API route for managing departments (fault departments)
 * GET /api/admin/departments - List all departments
 * POST /api/admin/departments - Create new department (ADMIN+ only)
 */

import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db/prisma";
import { requireMinimumRole } from "@/lib/auth/permissions";
import { ROLES } from "@/lib/auth/roles";

export async function GET(request: NextRequest) {
  try {
    const prisma = await getPrisma();
    // Anyone can read departments
    const departments = await prisma.department.findMany({
      orderBy: [
        { isSystem: "desc" }, // System departments first
        { name: "asc" },
      ],
    });

    return NextResponse.json({ departments });
  } catch (error) {
    console.error("Error fetching departments:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch departments" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const prisma = await getPrisma();
    // Only ADMIN+ can create departments
    await requireMinimumRole(ROLES.ADMIN);

    const body = await request.json();
    const { name } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Department name is required" },
        { status: 400 }
      );
    }

    // Check if department with this name already exists
    const existing = await prisma.department.findUnique({
      where: { name: name.trim() },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Department with this name already exists" },
        { status: 400 }
      );
    }

    const department = await prisma.department.create({
      data: {
        name: name.trim(),
        isSystem: false, // User-created departments are not system departments
      },
    });

    return NextResponse.json({ department });
  } catch (error) {
    console.error("Error creating department:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create department" },
      { status: 500 }
    );
  }
}
