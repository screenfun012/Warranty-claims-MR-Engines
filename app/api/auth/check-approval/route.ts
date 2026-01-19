import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db/prisma";
import { auth0 } from "@/lib/auth0";

/**
 * Check if the current user is approved to access the application
 * Creates user in database if they don't exist (new signup)
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
    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          fullName: session.user.name || session.user.nickname || null,
          role: "VIEWER", // Default role for new users
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
      
      console.log(`[Check Approval] Created new user: ${email}`);
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
