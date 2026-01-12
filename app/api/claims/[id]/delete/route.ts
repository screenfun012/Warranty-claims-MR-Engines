/**
 * DELETE /api/claims/[id]/delete
 * Delete a claim (super admin only)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { isSuperAdmin } from "@/lib/auth/permissions";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Get user email from header (X-User-Email)
    const userEmail = request.headers.get("X-User-Email");
    
    // Check if user is super admin
    if (!isSuperAdmin(userEmail)) {
      return NextResponse.json(
        { error: "Unauthorized: Super admin access required" },
        { status: 403 }
      );
    }

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
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to delete claim: ${errorMessage}` },
      { status: 500 }
    );
  }
}


