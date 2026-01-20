/**
 * API routes for individual customers
 * PATCH /api/customers/[id] - Update customer
 */

import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const prisma = await getPrisma();
    const { id } = await params;
    const body = await request.json();

    // Sanitize the data
    const updateData: Record<string, string | null> = {};
    if (body.name !== undefined) {
      updateData.name = body.name && body.name.trim() ? body.name.trim() : null;
    }
    if (body.company !== undefined) {
      updateData.company = body.company && body.company.trim() ? body.company.trim() : null;
    }
    if (body.email !== undefined) {
      updateData.email = body.email && body.email.trim() ? body.email.trim() : null;
    }
    if (body.country !== undefined) {
      updateData.country = body.country && body.country.trim() ? body.country.trim() : null;
    }
    if (body.notes !== undefined) {
      updateData.notes = body.notes && body.notes.trim() ? body.notes.trim() : null;
    }

    const customer = await prisma.customer.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ customer });
  } catch (error) {
    console.error("Error updating customer:", error);
    return NextResponse.json(
      { error: "Failed to update customer" },
      { status: 500 }
    );
  }
}

