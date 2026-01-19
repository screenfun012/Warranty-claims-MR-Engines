import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db/prisma";
import { requirePermission, createPermissionError, PERMISSIONS } from "@/lib/auth/permissions";
import { auth0 } from "@/lib/auth0";
import { getUserByEmail, getUserRoles } from "@/lib/auth0-management";

/**
 * Get all users from Prisma database
 * If no users exist, attempts to sync current user from Auth0
 */
export async function GET(request: NextRequest) {
  try {
    const prisma = await getPrisma();
    // Only SUPER_ADMIN can manage users
    await requirePermission(PERMISSIONS.ADMIN_USERS);

    let users = await prisma.user.findMany({
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        active: true,
        approved: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // If no users in database, try to sync current user from Auth0
    if (users.length === 0) {
      try {
        const session = await auth0.getSession(request);
        if (session && session.user && session.user.email) {
          const currentUserEmail = session.user.email;
          const auth0User = await getUserByEmail(currentUserEmail);
          
          if (auth0User) {
            const userId = auth0User.user_id || auth0User.sub || '';
            let roles: string[] = [];
            try {
              roles = await getUserRoles(userId);
            } catch (error) {
              roles = ['OPERATOR'];
            }

            const role = roles.length > 0 ? roles[0] : 'OPERATOR';

            // Create user in Prisma database
            const newUser = await prisma.user.upsert({
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

            // Re-fetch users after creating the current user
            users = await prisma.user.findMany({
              select: {
                id: true,
                fullName: true,
                email: true,
                role: true,
                active: true,
                approved: true,
                createdAt: true,
              },
              orderBy: {
                createdAt: "desc",
              },
            });
          }
        }
      } catch (syncError) {
        // If sync fails, just return empty array
        console.warn('[Get Users] Failed to sync current user:', syncError);
      }
    }

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
