/**
 * API routes for customers
 * POST /api/customers - Create customer
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, claimId } = body;

    if (!name) {
      return NextResponse.json({ error: "Customer name is required" }, { status: 400 });
    }

    const customer = await prisma.customer.create({
      data: {
        name,
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

