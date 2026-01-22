/**
 * DELETE /api/claims/[id]/delete
 * Delete a claim (SUPER_ADMIN only)
 */

import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db/prisma";
import { requirePermission, createPermissionError, PERMISSIONS } from "@/lib/auth/permissions";
import { logActivityFromRequest } from "@/lib/activity-log";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const prisma = await getPrisma();
    // Only SUPER_ADMIN can delete claims
    await requirePermission(PERMISSIONS.CLAIMS_DELETE);
    
    const { id } = await params;

    // Verify claim exists and get info for logging
    const claim = await prisma.claim.findUnique({
      where: { id },
      include: {
        attachments: true,
        emailThreads: true,
        customer: true,
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
    const { deleteAttachmentFile, deleteClaimFolder } = await import("@/lib/files/fileStorage");
    
    // Delete individual attachment files
    for (const attachment of claim.attachments) {
      try {
        await deleteAttachmentFile(attachment.filePath);
      } catch (error) {
        console.error(`Error deleting file ${attachment.filePath}:`, error);
        // Continue even if file deletion fails
      }
    }

    // Delete the entire claim folder from NAS (if it exists)
    // This ensures complete cleanup - folder and all subfolders are removed
    try {
      await deleteClaimFolder(claim);
      console.log(`[Delete Claim] Successfully deleted claim folder for ${claim.claimCodeRaw || claim.id}`);
    } catch (error) {
      console.error(`[Delete Claim] Error deleting claim folder:`, error);
      // Continue even if folder deletion fails - don't block claim deletion
    }

    // Delete the claim from database (cascade will handle related records)
    // Proveri da claim još uvek postoji pre brisanja (može biti obrisan u međuvremenu)
    const existingClaim = await prisma.claim.findUnique({
      where: { id },
      select: { id: true, customerId: true },
    });
    
    if (!existingClaim) {
      return NextResponse.json(
        { error: "Claim not found or already deleted" },
        { status: 404 }
      );
    }
    
    const customerIdToCheck = existingClaim.customerId;
    
    await prisma.claim.delete({
      where: { id },
    });

    // Clean up orphaned customer (if they have no other claims)
    if (customerIdToCheck) {
      const remainingClaims = await prisma.claim.count({
        where: { customerId: customerIdToCheck },
      });
      
      if (remainingClaims === 0) {
        try {
          await prisma.customer.delete({
            where: { id: customerIdToCheck },
          });
          console.log(`[Delete Claim] Deleted orphaned customer ${customerIdToCheck}`);
        } catch (err) {
          console.error(`[Delete Claim] Error deleting orphaned customer:`, err);
          // Don't fail if customer deletion fails
        }
      }
    }

    // Log activity (non-blocking)
    logActivityFromRequest(request, {
      action: "DELETE",
      entityType: "CLAIM",
      entityId: id,
      entityName: claim.claimCodeRaw || "Reklamacija",
      details: {
        customer: claim.customer?.company || claim.customer?.name,
        status: claim.status,
        attachmentsDeleted: claim.attachments.length,
      },
    }).catch(console.error);

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


