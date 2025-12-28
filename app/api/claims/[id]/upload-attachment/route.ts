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

    // Determine file type - check extension first, then mimeType
    const mimeType = file.type || "application/octet-stream";
    const fileName = file.name || "";
    const fileNameLower = fileName.toLowerCase();
    
    // Check by extension first (more reliable)
    const isImageByExt = /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)$/i.test(fileName);
    const isPdfByExt = fileNameLower.endsWith(".pdf");
    const isDocxByExt = fileNameLower.endsWith(".docx") || fileNameLower.endsWith(".doc");
    
    // Check by mimeType
    const isImageByMime = mimeType.startsWith("image/");
    const isPdfByMime = mimeType === "application/pdf" || mimeType.includes("pdf");
    const isDocxByMime = mimeType.includes("wordprocessingml") || 
                        mimeType.includes("application/vnd.openxmlformats-officedocument.wordprocessingml") ||
                        mimeType.includes("application/msword");
    
    // Final determination (extension takes priority)
    const isImage = isImageByExt || (isImageByMime && !isPdfByExt && !isDocxByExt);
    const isPdf = isPdfByExt || (isPdfByMime && !isImageByExt && !isDocxByExt);
    const isDocx = isDocxByExt || (isDocxByMime && !isImageByExt && !isPdfByExt);

    // Create Photo if it's an image (and NOT a PDF/DOCX)
    if (isImage && !isPdf && !isDocx) {
      await prisma.photo.create({
        data: {
          claimId: claim.id,
          attachmentId: attachment.id,
          internalUpload: true,
        },
      });
    }

    // Create ClientDocument if it's PDF or DOCX (and NOT an image)
    if ((isPdf || isDocx) && !isImage) {
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

