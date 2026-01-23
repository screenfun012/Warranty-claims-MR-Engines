import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db/prisma";
import { auth0 } from "@/lib/auth0";
import { getUserRoles, clearRoleCache } from "@/lib/auth0-management";

/**
 * Debug endpoint to fix user role
 * POST /api/debug/fix-user-role
 * Body: { email: string, newRole: string }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth0.getSession(request);
    
    // Only allow authenticated users
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Check if current user is SUPER_ADMIN
    const userRoles = (session.user as any)?.['https://mr-engines-warranty/roles'] || [];
    const isSuperAdmin = Array.isArray(userRoles) 
      ? userRoles.includes('SUPER_ADMIN') 
      : userRoles === 'SUPER_ADMIN';

    if (!isSuperAdmin) {
      // Also check Management API
      const userId = (session.user as any).sub;
      if (userId) {
        const rolesFromApi = await getUserRoles(userId);
        if (!rolesFromApi.includes('SUPER_ADMIN')) {
          return NextResponse.json(
            { error: "Only SUPER_ADMIN can change roles" },
            { status: 403 }
          );
        }
      } else {
        return NextResponse.json(
          { error: "Only SUPER_ADMIN can change roles" },
          { status: 403 }
        );
      }
    }

    const body = await request.json();
    const { email, newRole } = body;

    if (!email || !newRole) {
      return NextResponse.json(
        { error: "Missing email or newRole in request body" },
        { status: 400 }
      );
    }

    const validRoles = ["SUPER_ADMIN", "ADMIN", "OPERATOR", "VIEWER"];
    if (!validRoles.includes(newRole)) {
      return NextResponse.json(
        { error: `Invalid role. Must be one of: ${validRoles.join(", ")}` },
        { status: 400 }
      );
    }

    const prisma = await getPrisma();

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json(
        { error: `User with email "${email}" not found in database` },
        { status: 404 }
      );
    }

    // Update user role
    const updatedUser = await prisma.user.update({
      where: { email },
      data: { role: newRole },
    });

    // Clear role cache for all users (just to be safe)
    clearRoleCache();

    return NextResponse.json({
      success: true,
      message: `Role updated successfully`,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        fullName: updatedUser.fullName,
        role: updatedUser.role,
        previousRole: user.role,
      },
      note: "This only updates the database. Auth0 role may still be different. User should log out and log back in.",
    });
  } catch (error) {
    console.error("[Debug Fix User Role] Error:", error);
    return NextResponse.json(
      { 
        error: "Failed to update role", 
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
