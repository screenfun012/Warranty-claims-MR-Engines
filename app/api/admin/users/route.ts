import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db/prisma";
import { requirePermission, createPermissionError, PERMISSIONS } from "@/lib/auth/permissions";

export async function GET(request: NextRequest) {
  try {
    const prisma = await getPrisma();
    // Only SUPER_ADMIN can manage users
    await requirePermission(PERMISSIONS.ADMIN_USERS);

    const users = await prisma.user.findMany({
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        active: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error("Error fetching users:", error);
    const permError = createPermissionError(error);
    if (permError.status !== 500) {
      return NextResponse.json({ error: permError.message }, { status: permError.status });
    }
    return NextResponse.json(
      { error: "Greška pri učitavanju korisnika" },
      { status: 500 }
    );
  }
}
