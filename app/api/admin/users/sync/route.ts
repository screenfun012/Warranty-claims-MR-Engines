import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db/prisma";
import { requirePermission, createPermissionError, PERMISSIONS } from "@/lib/auth/permissions";
import { auth0 } from "@/lib/auth0";
import { getUserByEmail, getUserRoles } from "@/lib/auth0-management";

/**
 * Sync Auth0 users to Prisma database
 * Creates or updates users in Prisma based on Auth0 users
 */
export async function POST(request: NextRequest) {
  try {
    // Only SUPER_ADMIN can sync users
    await requirePermission(PERMISSIONS.ADMIN_USERS);
  } catch (error) {
    const permError = createPermissionError(error);
    if (permError.status !== 500) {
      return NextResponse.json({ error: permError.message }, { status: permError.status });
    }
    return NextResponse.json(
      { error: "Greška pri sinhronizaciji korisnika" },
      { status: 500 }
    );
  }

  try {
    const prisma = await getPrisma();
    const session = await auth0.getSession(request);
    
    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Niste prijavljeni" },
        { status: 401 }
      );
    }

    // Get current user's email from session
    const currentUserEmail = session.user.email;
    if (!currentUserEmail) {
      return NextResponse.json(
        { error: "Email adresa nije dostupna" },
        { status: 400 }
      );
    }

    // For now, sync only the current user
    // In the future, we can sync all Auth0 users if needed
    const auth0User = await getUserByEmail(currentUserEmail);
    
    if (!auth0User) {
      return NextResponse.json(
        { error: "Korisnik nije pronađen u Auth0" },
        { status: 404 }
      );
    }

    // Get user roles from Auth0
    const userId = auth0User.user_id || auth0User.sub || '';
    let roles: string[] = [];
    try {
      roles = await getUserRoles(userId);
    } catch (error) {
      console.warn('[Sync Users] Could not fetch roles from Management API, using default OPERATOR');
      roles = ['OPERATOR'];
    }

    const role = roles.length > 0 ? roles[0] : 'OPERATOR';

    // Create or update user in Prisma database
    const user = await prisma.user.upsert({
      where: { email: currentUserEmail },
      update: {
        fullName: auth0User.name || auth0User.nickname || null,
        role: role,
        emailVerified: auth0User.email_verified ? new Date() : null,
        updatedAt: new Date(),
      },
      create: {
        email: currentUserEmail,
        fullName: auth0User.name || auth0User.nickname || null,
        role: role,
        emailVerified: auth0User.email_verified ? new Date() : null,
        active: true,
      },
    });

    return NextResponse.json({ 
      success: true, 
      message: "Korisnik je sinhronizovan",
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      }
    });
  } catch (error) {
    console.error("Error syncing users:", error);
    return NextResponse.json(
      { error: "Greška pri sinhronizaciji korisnika" },
      { status: 500 }
    );
  }
}
