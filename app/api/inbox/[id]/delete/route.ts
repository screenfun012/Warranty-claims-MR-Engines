/**
 * DELETE /api/inbox/[id]/delete
 * Delete an email thread (SUPER_ADMIN only)
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
    // Only SUPER_ADMIN can delete inbox items
    await requirePermission(PERMISSIONS.INBOX_DELETE);
    
    const { id } = await params;

    // Verify thread exists
    const thread = await prisma.emailThread.findUnique({
      where: { id },
      include: {
        messages: {
          include: {
            attachments: true,
          },
        },
        claim: {
          include: {
            attachments: true,
          },
        },
      },
    });

    if (!thread) {
      return NextResponse.json(
        { error: "Email thread not found" },
        { status: 404 }
      );
    }

    // If thread has an associated claim, delete the claim and all its files
    if (thread.claimId && thread.claim) {
      const claim = thread.claim;
      
      // Delete all claim attachment files
      const { deleteAttachmentFile, deleteClaimFolder } = await import("@/lib/files/fileStorage");
      
      for (const attachment of claim.attachments) {
        try {
          await deleteAttachmentFile(attachment.filePath);
        } catch (error) {
          console.error(`Error deleting claim file ${attachment.filePath}:`, error);
        }
      }

      // Delete the entire claim folder from NAS/Synology
      try {
        await deleteClaimFolder(claim);
        console.log(`[Delete Email Thread] Successfully deleted claim folder for ${claim.claimCodeRaw || claim.id}`);
      } catch (error) {
        console.error(`[Delete Email Thread] Error deleting claim folder:`, error);
      }

      // Delete the claim from database (cascade will handle related records)
      await prisma.claim.delete({
        where: { id: claim.id },
      });
      
      console.log(`[Delete Email Thread] Deleted associated claim ${claim.id}`);
    }

    // CRITICAL: Track deleted messageIds BEFORE deletion to prevent sync from recreating them
    // This ensures that once a mail is deleted, it won't come back during sync
    for (const message of thread.messages) {
      if (message.messageId) {
        try {
          await prisma.deletedEmailMessage.upsert({
            where: { messageId: message.messageId },
            update: { 
              threadId: id,
              deletedAt: new Date(),
            },
            create: {
              messageId: message.messageId,
              threadId: id,
              deletedAt: new Date(),
            },
          });
          console.log(`[Delete] Tracked deleted messageId: ${message.messageId}`);
        } catch (error) {
          console.error(`[Delete] Error tracking deleted messageId ${message.messageId}:`, error);
          // Continue even if tracking fails - don't block deletion
        }
      }
    }

    // Delete all attachment files from disk
    const { deleteAttachmentFile } = await import("@/lib/files/fileStorage");
    
    for (const message of thread.messages) {
      for (const attachment of message.attachments) {
        try {
          await deleteAttachmentFile(attachment.filePath);
        } catch (error) {
          console.error(`Error deleting file ${attachment.filePath}:`, error);
          // Continue even if file deletion fails
        }
      }
    }

    // Delete the thread (cascade will handle related records)
    await prisma.emailThread.delete({
      where: { id },
    });

    return NextResponse.json({ 
      success: true,
      message: "Email thread deleted successfully" 
    });
  } catch (error) {
    console.error("Error deleting email thread:", error);
    const permError = createPermissionError(error);
    if (permError.status !== 500) {
      return NextResponse.json({ error: permError.message }, { status: permError.status });
    }
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to delete email thread: ${errorMessage}` },
      { status: 500 }
    );
  }
}


