import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { saveAttachmentForClaim } from "@/lib/files/fileStorage";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: claimId } = await params;

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

    // Parse form data
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Save file to disk
    const filePath = await saveAttachmentForClaim({
      claim,
      fileBuffer: buffer,
      originalFileName: file.name,
      mimeType: file.type || "application/octet-stream",
      subfolder: "03_attachments",
    });

    // Create attachment record
    const attachment = await prisma.attachment.create({
      data: {
        claimId: claim.id,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        filePath,
        isRelevant: true,
        source: "INTERNAL_TEARDOWN",
      },
    });

    // Determine if it's an image or document
    const isImage = file.type.startsWith("image/");
    const isPdf = file.type === "application/pdf";
    const isDocx = file.type.includes("wordprocessingml") || 
                   file.type.includes("application/vnd.openxmlformats-officedocument.wordprocessingml") ||
                   file.name.toLowerCase().endsWith(".docx");

    // Create Photo if it's an image
    if (isImage) {
      await prisma.photo.create({
        data: {
          claimId: claim.id,
          attachmentId: attachment.id,
          internalUpload: true,
        },
      });
    }

    // Create ClientDocument if it's PDF or DOCX
    if (isPdf || isDocx) {
      await prisma.clientDocument.create({
        data: {
          claimId: claim.id,
          attachmentId: attachment.id,
          textOriginal: "",
          originalLanguage: "SR",
        },
      });
    }

    return NextResponse.json({
      success: true,
      attachment,
      message: `File uploaded successfully${isImage ? " (added to Photos)" : isPdf || isDocx ? " (added to Documents)" : ""}`,
    });
  } catch (error) {
    console.error("Error uploading attachment:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to upload attachment" },
      { status: 500 }
    );
  }
}

