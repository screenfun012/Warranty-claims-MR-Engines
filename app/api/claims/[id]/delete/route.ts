/**
 * DELETE /api/claims/[id]/delete
 * Delete a claim (SUPER_ADMIN only)
 */

import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db/prisma";
import { requirePermission, createPermissionError, PERMISSIONS } from "@/lib/auth/permissions";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const prisma = await getPrisma();
    // Only SUPER_ADMIN can delete claims
    await requirePermission(PERMISSIONS.CLAIMS_DELETE);
    
    const { id } = await params;

    // Verify claim exists
    const claim = await prisma.claim.findUnique({
      where: { id },
      include: {
        attachments: true,
        emailThreads: true,
      },
    });

    if (!claim) {
      return NextResponse.json(
        { error: "Claim not found" },
        { status: 404 }
      );
    }

    // Delete all related records
    // Attachments will be deleted via cascade, but we need to delete files from disk
    const { deleteAttachmentFile } = await import("@/lib/files/fileStorage");
    
    for (const attachment of claim.attachments) {
      try {
        await deleteAttachmentFile(attachment.filePath);
      } catch (error) {
        console.error(`Error deleting file ${attachment.filePath}:`, error);
        // Continue even if file deletion fails
      }
    }

    // Delete the claim (cascade will handle related records)
    await prisma.claim.delete({
      where: { id },
    });

    return NextResponse.json({ 
      success: true,
      message: "Claim deleted successfully" 
    });
  } catch (error) {
    console.error("Error deleting claim:", error);
    const permError = createPermissionError(error);
    if (permError.status !== 500) {
      return NextResponse.json({ error: permError.message }, { status: permError.status });
    }
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to delete claim: ${errorMessage}` },
      { status: 500 }
    );
  }
}


