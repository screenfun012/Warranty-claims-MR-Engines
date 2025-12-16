/**
 * API route for extracting text from PDF and DOCX attachments
 * POST /api/attachments/[id]/extract-pdf
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { readAttachmentFile } from "@/lib/files/fileStorage";
import { extractTextFromPdf } from "@/lib/files/pdfTextExtractor";
import { extractTextFromDocx } from "@/lib/files/docxTextExtractor";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const attachment = await prisma.attachment.findUnique({
      where: { id },
    });

    if (!attachment) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
    }

    const isPdf = attachment.mimeType.includes("pdf");
    const isDocx = attachment.mimeType.includes("wordprocessingml") || 
                   attachment.mimeType.includes("application/vnd.openxmlformats-officedocument.wordprocessingml") ||
                   attachment.fileName.toLowerCase().endsWith(".docx");

    if (!isPdf && !isDocx) {
      return NextResponse.json({ error: "Attachment is not a PDF or DOCX file" }, { status: 400 });
    }

    // Read and extract text
    const fileBuffer = await readAttachmentFile(attachment.filePath);
    const extractedText = isPdf 
      ? await extractTextFromPdf(fileBuffer)
      : await extractTextFromDocx(fileBuffer);

    // Update attachment with extracted text
    const updated = await prisma.attachment.update({
      where: { id },
      data: { textOriginal: extractedText },
    });

    return NextResponse.json({
      success: true,
      attachment: updated,
      extractedText,
    });
  } catch (error) {
    console.error("Error extracting text:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to extract text" },
      { status: 500 }
    );
  }
}

