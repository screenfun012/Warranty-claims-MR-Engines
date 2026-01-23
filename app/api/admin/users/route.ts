import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db/prisma";
import { requirePermission, createPermissionError, PERMISSIONS } from "@/lib/auth/permissions";
import { getUserByEmail, getUserRoles } from "@/lib/auth0-management";

/**
 * Get all users from Prisma database
 * If sync=true query param is provided, syncs roles from Auth0
 */
export async function GET(request: NextRequest) {
  try {
    const prisma = await getPrisma();
    // Only SUPER_ADMIN can manage users
    await requirePermission(PERMISSIONS.ADMIN_USERS);

    const { searchParams } = new URL(request.url);
    const shouldSync = searchParams.get("sync") === "true";

    // Get all users from database
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

    // Sync roles from Auth0 if requested
    if (shouldSync) {
      console.log("[Admin Users] Syncing roles from Auth0...");
      const syncResults: string[] = [];
      
      for (const user of users) {
        if (!user.email) continue;
        
        try {
          // Find user in Auth0
          const auth0User = await getUserByEmail(user.email);
          if (!auth0User) {
            syncResults.push(`${user.email}: not found in Auth0`);
            continue;
          }
          
          // Get roles from Auth0
          const roles = await getUserRoles(auth0User.user_id);
          const auth0Role = roles.length > 0 ? roles[0] : null;
          
          // Update if different
          if (auth0Role && user.role !== auth0Role) {
            await prisma.user.update({
              where: { id: user.id },
              data: { role: auth0Role },
            });
            syncResults.push(`${user.email}: ${user.role} -> ${auth0Role}`);
            user.role = auth0Role; // Update in response
          } else {
            syncResults.push(`${user.email}: OK (${user.role})`);
          }
          
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
          console.warn(`[Admin Users] Error syncing ${user.email}:`, error);
          syncResults.push(`${user.email}: error`);
        }
      }
      
      console.log("[Admin Users] Sync results:", syncResults);
      return NextResponse.json({ users, syncResults });
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
