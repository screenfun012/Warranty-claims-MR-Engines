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
    const customers = await prisma.customer.findMany({
      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json({ customers });
  } catch (error) {
    console.error("Error fetching customers:", error);
    return NextResponse.json(
      { error: "Failed to fetch customers" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const prisma = await getPrisma();
    const body = await request.json();
    const { name, company, claimId } = body;

    if (!name) {
      return NextResponse.json({ error: "Customer name is required" }, { status: 400 });
    }

    const customer = await prisma.customer.create({
      data: {
        name,
        company: company || undefined,
      },
    });

    // If claimId is provided, link the customer to the claim
    if (claimId) {
      await prisma.claim.update({
        where: { id: claimId },
        data: { customerId: customer.id },
      });
    }

    return NextResponse.json({ customer });
  } catch (error) {
    console.error("Error creating customer:", error);
    return NextResponse.json(
      { error: "Failed to create customer" },
      { status: 500 }
    );
  }
}

