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
      },
    });

    if (!thread) {
      return NextResponse.json(
        { error: "Email thread not found" },
        { status: 404 }
      );
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


