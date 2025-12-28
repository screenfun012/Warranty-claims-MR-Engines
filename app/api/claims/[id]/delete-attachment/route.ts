import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { deleteAttachmentFile } from "@/lib/files/fileStorage";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: claimId } = await params;
    const { searchParams } = new URL(request.url);
    const attachmentId = searchParams.get("attachmentId");

    if (!attachmentId) {
      return NextResponse.json(
        { error: "Attachment ID is required" },
        { status: 400 }
      );
    }

    // Verify claim exists
    const claim = await prisma.claim.findUnique({
      where: { id: claimId },
    });

    if (!claim) {
      return NextResponse.json(
        { error: "Claim not found" },
        { status: 404 }
      );
    }

    // Find the attachment
    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
      include: {
        photo: true,
        clientDocument: true,
      },
    });

    if (!attachment) {
      return NextResponse.json(
        { error: "Attachment not found" },
        { status: 404 }
      );
    }

    // Verify attachment belongs to this claim
    if (attachment.claimId !== claimId) {
      return NextResponse.json(
        { error: "Attachment does not belong to this claim" },
        { status: 403 }
      );
    }

    // Only allow deletion of internally uploaded files
    // (source is INTERNAL_TEARDOWN or OTHER, or photo has internalUpload = true)
    const isInternal = attachment.source === "INTERNAL_TEARDOWN" || 
                      attachment.source === "OTHER" ||
                      attachment.photo?.internalUpload === true;

    if (!isInternal) {
      return NextResponse.json(
        { error: "Only internally uploaded files can be deleted" },
        { status: 403 }
      );
    }

    // Delete related Photo record if it exists
    if (attachment.photo) {
      await prisma.photo.delete({
        where: { id: attachment.photo.id },
      });
    }

    // Delete related ClientDocument record if it exists
    if (attachment.clientDocument) {
      await prisma.clientDocument.delete({
        where: { id: attachment.clientDocument.id },
      });
    }

    // Delete the file from disk
    if (attachment.filePath) {
      await deleteAttachmentFile(attachment.filePath);
    }

    // Delete the attachment record
    await prisma.attachment.delete({
      where: { id: attachmentId },
    });

    return NextResponse.json({
      success: true,
      message: "Attachment deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting attachment:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete attachment" },
      { status: 500 }
    );
  }
}

