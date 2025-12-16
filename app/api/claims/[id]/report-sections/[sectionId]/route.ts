/**
 * API route for updating report sections
 * PATCH /api/claims/[id]/report-sections/[sectionId] - Update report section
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sectionId: string }> }
) {
  try {
    const { id, sectionId } = await params;
    const body = await request.json();

    // Verify that the section belongs to this claim
    const section = await prisma.reportSection.findFirst({
      where: {
        id: sectionId,
        claimId: id,
      },
    });

    if (!section) {
      return NextResponse.json(
        { error: "Report section not found or does not belong to this claim" },
        { status: 404 }
      );
    }

    // Update the section
    const updatedSection = await prisma.reportSection.update({
      where: { id: sectionId },
      data: {
        textSr: body.textSr !== undefined ? body.textSr : section.textSr,
        textEn: body.textEn !== undefined ? body.textEn : section.textEn,
      },
    });

    return NextResponse.json({ section: updatedSection });
  } catch (error) {
    console.error("Error updating report section:", error);
    return NextResponse.json(
      { error: "Failed to update report section" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sectionId: string }> }
) {
  try {
    const { id, sectionId } = await params;

    // Verify that the section belongs to this claim
    const section = await prisma.reportSection.findFirst({
      where: {
        id: sectionId,
        claimId: id,
      },
    });

    if (!section) {
      return NextResponse.json(
        { error: "Report section not found or does not belong to this claim" },
        { status: 404 }
      );
    }

    // Delete the section
    await prisma.reportSection.delete({
      where: { id: sectionId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting report section:", error);
    return NextResponse.json(
      { error: "Failed to delete report section" },
      { status: 500 }
    );
  }
}

