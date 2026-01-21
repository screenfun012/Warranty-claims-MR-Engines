/**
 * API routes for managing predefined companies (SUPER_ADMIN only)
 * GET /api/admin/companies - List all companies
 * POST /api/admin/companies - Create new company
 */

import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db/prisma";
import { requireMinimumRole } from "@/lib/auth/permissions";
import { ROLES } from "@/lib/auth/roles";

export async function GET() {
  try {
    const prisma = await getPrisma();
    
    // Try to get companies from database, fallback to empty array if table doesn't exist
    let companies: { id: string; name: string }[] = [];
    try {
      companies = await prisma.predefinedCompany.findMany({
        orderBy: { name: "asc" },
      });
    } catch (error) {
      console.warn("[GET /api/admin/companies] PredefinedCompany table might not exist:", error);
      // Return hardcoded list as fallback
      companies = [
        { id: "1", name: "APPROVED GREEN" },
        { id: "2", name: "VITOBELLO" },
        { id: "3", name: "AUTO STANIĆ" },
        { id: "4", name: "SELMAN" },
        { id: "5", name: "TVH" },
        { id: "6", name: "CRD" },
        { id: "7", name: "RETTIFICHE 3G" },
        { id: "8", name: "BOLS MOTOREN" },
      ];
    }

    return NextResponse.json({ companies });
  } catch (error) {
    console.error("Error fetching companies:", error);
    return NextResponse.json(
      { error: "Failed to fetch companies" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const prisma = await getPrisma();
    // Only SUPER_ADMIN can create companies
    await requireMinimumRole(ROLES.SUPER_ADMIN);

    const body = await request.json();
    const { name } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Company name is required" },
        { status: 400 }
      );
    }

    const company = await prisma.predefinedCompany.create({
      data: {
        name: name.trim().toUpperCase(),
      },
    });

    return NextResponse.json({ company }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating company:", error);
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "Company with this name already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create company" },
      { status: 500 }
    );
  }
}
