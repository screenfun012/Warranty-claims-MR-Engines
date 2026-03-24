/**
 * API routes for managing predefined companies (SUPER_ADMIN only)
 * GET /api/admin/companies - List all companies
 * POST /api/admin/companies - Create new company
 */

import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db/prisma";
import { requireMinimumRole } from "@/lib/auth/permissions";
import { ROLES } from "@/lib/auth/roles";
import { SEED_PREDEFINED_COMPANY_NAMES } from "@/lib/config/predefinedSeeds";

export async function GET() {
  try {
    const prisma = await getPrisma();
    
    // Try to get companies from database, fallback to empty array if table doesn't exist
    let companies: { id: string; name: string }[] = [];
    try {
      companies = await prisma.predefinedCompany.findMany({
        orderBy: { name: "asc" },
      });
      // Tabela postoji ali je prazna → ponovo ubaci seed (INSERT OR IGNORE ponašanje)
      if (companies.length === 0) {
        await prisma.predefinedCompany.createMany({
          data: SEED_PREDEFINED_COMPANY_NAMES.map((name) => ({ name })),
        });
        companies = await prisma.predefinedCompany.findMany({
          orderBy: { name: "asc" },
        });
        if (companies.length > 0) {
          console.warn("[GET /api/admin/companies] Table was empty; re-seeded default companies.");
        }
      }
    } catch (error) {
      console.warn("[GET /api/admin/companies] PredefinedCompany table might not exist:", error);
      // Return hardcoded list as fallback
      companies = SEED_PREDEFINED_COMPANY_NAMES.map((name, i) => ({
        id: `fallback-${i}`,
        name,
      }));
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
