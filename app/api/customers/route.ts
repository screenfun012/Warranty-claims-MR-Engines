/**
 * API routes for customers
 * GET /api/customers - List all customers
 * POST /api/customers - Create customer
 */

import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db/prisma";

export async function GET(request: NextRequest) {
  try {
    const prisma = await getPrisma();
    // SQLite doesn't handle null values well in orderBy, so we fetch all and sort in memory
    const customers = await prisma.customer.findMany();
    
    // Sort by company first, then by name (nulls last)
    customers.sort((a, b) => {
      const companyA = a.company || "";
      const companyB = b.company || "";
      if (companyA !== companyB) {
        return companyA.localeCompare(companyB);
      }
      const nameA = a.name || "";
      const nameB = b.name || "";
      return nameA.localeCompare(nameB);
    });

    return NextResponse.json({ customers });
  } catch (error) {
    console.error("Error fetching customers:", error);
    return NextResponse.json(
      { error: "Failed to fetch customers", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  let body: any = null;
  try {
    const prisma = await getPrisma();
    body = await request.json();
    const { name, company, claimId } = body;

    // At least name or company must be provided
    if (!name && !company) {
      return NextResponse.json({ error: "Customer name or company is required" }, { status: 400 });
    }

    // Normalize values: empty strings become null
    const normalizedName = name && typeof name === 'string' && name.trim() ? name.trim() : null;
    const normalizedCompany = company && typeof company === 'string' && company.trim() ? company.trim() : null;

    // Double-check: at least one must be non-null
    if (!normalizedName && !normalizedCompany) {
      return NextResponse.json({ error: "Customer name or company is required" }, { status: 400 });
    }

    const customer = await prisma.customer.create({
      data: {
        name: normalizedName,
        company: normalizedCompany,
      },
    });

    // If claimId is provided, link the customer to the claim
    if (claimId) {
      try {
        await prisma.claim.update({
          where: { id: claimId },
          data: { customerId: customer.id },
        });
      } catch (claimError) {
        console.error("Error linking customer to claim:", claimError);
        // Don't fail the whole request if claim linking fails
      }
    }

    return NextResponse.json({ customer });
  } catch (error) {
    console.error("Error creating customer:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorDetails = error instanceof Error ? error.stack : undefined;
    
    // Log full error details for debugging
    console.error("Full error details:", {
      message: errorMessage,
      stack: errorDetails,
      requestBody: body,
    });

    return NextResponse.json(
      { 
        error: "Failed to create customer",
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      },
      { status: 500 }
    );
  }
}

