/**
 * API route for extracting text from PDF attachments
 * POST /api/claims/[id]/extract-pdf
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { readAttachmentFile } from "@/lib/files/fileStorage";
import { extractTextFromPdf } from "@/lib/files/pdfTextExtractor";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { attachmentId } = body;

    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
    });

    if (!attachment) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
    }

    if (!attachment.mimeType.includes("pdf")) {
      return NextResponse.json({ error: "Attachment is not a PDF" }, { status: 400 });
    }

    // Read and extract text
    const fileBuffer = await readAttachmentFile(attachment.filePath);
    const extractedText = await extractTextFromPdf(fileBuffer);

    // Create or update ClientDocument
    let clientDocument = await prisma.clientDocument.findUnique({
      where: { attachmentId },
    });

    if (clientDocument) {
      clientDocument = await prisma.clientDocument.update({
        where: { id: clientDocument.id },
        data: { textOriginal: extractedText },
      });
    } else {
      clientDocument = await prisma.clientDocument.create({
        data: {
          claimId: id,
          attachmentId,
          textOriginal: extractedText,
        },
      });
    }

    return NextResponse.json({
      success: true,
      clientDocument,
      extractedText,
    });
  } catch (error) {
    console.error("Error extracting PDF text:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to extract PDF text" },
      { status: 500 }
    );
  }
}

