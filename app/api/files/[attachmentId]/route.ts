/**
 * API route for serving attachment files
 * GET /api/files/[attachmentId]
 * Supports both filesystem and Vercel Blob storage
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { readAttachmentFile, getAttachmentFilePath } from "@/lib/files/fileStorage";
import { existsSync } from "fs";
import { env } from "@/lib/config/env";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ attachmentId: string }> }
) {
  try {
    const { attachmentId } = await params;

    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
    });

    if (!attachment) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
    }

    // If using Blob storage and filePath is a URL, redirect to Blob URL
    const isBlobUrl = attachment.filePath.startsWith('http://') || attachment.filePath.startsWith('https://');
    
    if (isBlobUrl || env.BLOB_READ_WRITE_TOKEN) {
      // For Blob URLs, redirect directly to the Blob URL (it's already public)
      if (isBlobUrl) {
        return NextResponse.redirect(attachment.filePath);
      }
      
      // If using Blob but filePath is not a URL yet, try to read it
      // (this handles migration period)
      try {
        const fileBuffer = await readAttachmentFile(attachment.filePath);
        return new NextResponse(new Uint8Array(fileBuffer), {
          headers: {
            "Content-Type": attachment.mimeType,
            "Content-Disposition": `inline; filename="${attachment.fileName}"`,
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      } catch (error) {
        console.error("Error reading blob file:", error);
        return NextResponse.json({ error: "File not found" }, { status: 404 });
      }
    }

    // Filesystem path - check if exists
    const filePath = getAttachmentFilePath(attachment.filePath);

    if (!existsSync(filePath)) {
      return NextResponse.json({ error: "File not found on disk" }, { status: 404 });
    }

    const fileBuffer = await readAttachmentFile(attachment.filePath);

    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        "Content-Type": attachment.mimeType,
        "Content-Disposition": `inline; filename="${attachment.fileName}"`,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("Error serving file:", error);
    return NextResponse.json(
      { error: "Failed to serve file" },
      { status: 500 }
    );
  }
}

