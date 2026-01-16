import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db/prisma";
import { requirePermission, createPermissionError, PERMISSIONS } from "@/lib/auth/permissions";
import { ROLES } from "@/lib/auth/roles";
import { getUserByEmail, getUserRoles, assignRoleToUser, removeRoleFromUser } from "@/lib/auth0-management";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const prisma = await getPrisma();
    // Only SUPER_ADMIN can manage users
    await requirePermission(PERMISSIONS.ADMIN_USERS);

    const { id } = await params;
    const body = await request.json();
    const { role, active } = body;

    // Provera da li korisnik postoji u Prisma bazi
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user || !user.email) {
      return NextResponse.json(
        { error: "Korisnik nije pronađen" },
        { status: 404 }
      );
    }

    // Validacija role
    if (role && !Object.values(ROLES).includes(role)) {
      return NextResponse.json(
        { error: "Neispravna uloga" },
        { status: 400 }
      );
    }

    // Ako se menja role, ažuriraj u Auth0
    if (role !== undefined) {
      try {
        // Pronađi korisnika u Auth0 po email-u
        const auth0User = await getUserByEmail(user.email);
        
        if (!auth0User) {
          return NextResponse.json(
            { error: "Korisnik nije pronađen u Auth0. Molimo prijavite se preko Auth0 login-a." },
            { status: 404 }
          );
        }

        // Proveri da li je korisnik SUPER_ADMIN - ne dozvoli promenu
        const currentRoles = await getUserRoles(auth0User.user_id);
        if (currentRoles.includes('SUPER_ADMIN') && role !== 'SUPER_ADMIN') {
          return NextResponse.json(
            { error: "Ne možete menjati super admin korisnika" },
            { status: 403 }
          );
        }

        // Ukloni sve postojeće role
        for (const currentRole of currentRoles) {
          await removeRoleFromUser(auth0User.user_id, currentRole);
        }
        
        // Dodeli novu role
        await assignRoleToUser(auth0User.user_id, role);
        
        console.log(`[Update User] Updated role for ${user.email} to ${role} in Auth0`);
      } catch (error) {
        console.error('[Update User] Error updating Auth0 role:', error);
        // Ne baci grešku ako je problem sa Management API, samo loguj
        // Možda korisnik nije u Auth0 ili Management API nije konfigurisan
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        if (errorMessage.includes('not initialized')) {
          return NextResponse.json(
            { error: "Auth0 Management API nije konfigurisan. Molimo dodajte AUTH0_MANAGEMENT_CLIENT_ID i AUTH0_MANAGEMENT_CLIENT_SECRET u .env.local" },
            { status: 500 }
          );
        }
        return NextResponse.json(
          { error: `Greška pri ažuriranju role u Auth0: ${errorMessage}` },
          { status: 500 }
        );
      }
    }

    // Ažuriranje u Prisma bazi (za backward compatibility)
    const updateData: any = {};
    if (role !== undefined) updateData.role = role;
    if (active !== undefined) updateData.active = active;

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        active: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ 
      user: updatedUser,
      message: role !== undefined 
        ? "Role je ažurirana u Auth0. Korisnik mora da se odjavi i uloguje ponovo da bi promene bile aktivne." 
        : "Korisnik je ažuriran"
    });
  } catch (error) {
    console.error("Error updating user:", error);
    const permError = createPermissionError(error);
    if (permError.status !== 500) {
      return NextResponse.json({ error: permError.message }, { status: permError.status });
    }
    return NextResponse.json(
      { error: "Greška pri ažuriranju korisnika" },
      { status: 500 }
    );
  }
}
