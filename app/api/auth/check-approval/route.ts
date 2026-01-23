import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db/prisma";
import { auth0 } from "@/lib/auth0";
import { getUserRoles } from "@/lib/auth0-management";

/**
 * Check if the current user is approved to access the application
 * Creates user in database if they don't exist (new signup)
 * ALSO syncs role from Auth0 to database on every login
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth0.getSession(request);
    
    if (!session || !session.user || !session.user.email) {
      return NextResponse.json(
        { approved: false, reason: "not_authenticated" },
        { status: 401 }
      );
    }

    const prisma = await getPrisma();
    const email = session.user.email;
    const auth0UserId = (session.user as any).sub;

    // Get role from Auth0 (source of truth)
    let auth0Role: string | null = null;
    if (auth0UserId) {
      try {
        const roles = await getUserRoles(auth0UserId);
        auth0Role = roles.length > 0 ? roles[0] : null;
        console.log(`[Check Approval] Auth0 role for ${email}: ${auth0Role}`);
      } catch (error) {
        console.warn(`[Check Approval] Could not fetch Auth0 role for ${email}:`, error);
      }
    }

    // Try to find user in database
    let user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        active: true,
        approved: true,
      },
    });

    // If user doesn't exist, create them (new signup)
    // IMPORTANT: User is created ONLY when there's a valid Auth0 session (real login)
    // This prevents accidental creation from Customer data or other sources
    if (!user) {
      // Double-check that we have a valid Auth0 session with user data
      if (!session.user || !session.user.email || session.user.email !== email) {
        console.error(`[Check Approval] Invalid session data - email mismatch or missing user data`);
        return NextResponse.json(
          { approved: false, reason: "invalid_session" },
          { status: 401 }
        );
      }

      // Use Auth0 role if available, otherwise default to VIEWER
      const initialRole = auth0Role || "VIEWER";

      user = await prisma.user.create({
        data: {
          email,
          fullName: session.user.name || session.user.nickname || null,
          role: initialRole,
          active: true,
          approved: false, // New users need approval
        },
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          active: true,
          approved: true,
        },
      });
      
      console.log(`[Check Approval] Created new user from Auth0 login: ${email} with role: ${initialRole}`);
    } else {
      // User exists - sync role from Auth0 if different
      if (auth0Role && user.role !== auth0Role) {
        console.log(`[Check Approval] Syncing role for ${email}: ${user.role} -> ${auth0Role}`);
        user = await prisma.user.update({
          where: { email },
          data: { role: auth0Role },
          select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
            active: true,
            approved: true,
          },
        });
      }
    }

    // Check if user is approved
    if (!user.approved) {
      return NextResponse.json({
        approved: false,
        reason: "pending_approval",
        user: {
          email: user.email,
          fullName: user.fullName,
        },
      });
    }

    // Check if user is active
    if (!user.active) {
      return NextResponse.json({
        approved: false,
        reason: "deactivated",
        user: {
          email: user.email,
          fullName: user.fullName,
        },
      });
    }

    // User is approved and active
    return NextResponse.json({
      approved: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("[Check Approval] Error:", error);
    return NextResponse.json(
      { approved: false, reason: "error", error: "Internal server error" },
      { status: 500 }
    );
  }
}
