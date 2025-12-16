/**
 * API route for creating report sections
 * POST /api/claims/[id]/report-sections - Create new report section
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Verify that the claim exists
    const claim = await prisma.claim.findUnique({
      where: { id },
    });

    if (!claim) {
      return NextResponse.json(
        { error: "Claim not found" },
        { status: 404 }
      );
    }

    // Create the section
    const section = await prisma.reportSection.create({
      data: {
        claimId: id,
        sectionType: body.sectionType || "FINDINGS",
        orderIndex: body.orderIndex ?? 0,
        textSr: body.textSr || "",
        textEn: body.textEn || "",
      },
    });

    return NextResponse.json({ section });
  } catch (error) {
    console.error("Error creating report section:", error);
    return NextResponse.json(
      { error: "Failed to create report section" },
      { status: 500 }
    );
  }
}

