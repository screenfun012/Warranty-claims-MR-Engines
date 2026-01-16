/**
 * API route for serving attachment files
 * GET /api/files/[attachmentId]
 * Supports filesystem, Vercel Blob, and WebDAV storage
 */

import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db/prisma";
import { readAttachmentFile, getAttachmentFilePath } from "@/lib/files/fileStorage";
import { existsSync } from "fs";
import { env } from "@/lib/config/env";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ attachmentId: string }> }
) {
  try {
    const { attachmentId } = await params;

    const prisma = await getPrisma();
    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
    });

    if (!attachment) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
    }

    // Check storage type
    const isWebDAV = attachment.filePath.startsWith('webdav:');
    const isBlobUrl = attachment.filePath.startsWith('http://') || attachment.filePath.startsWith('https://');
    
    // For Blob URLs, redirect directly to the Blob URL (it's already public)
    if (isBlobUrl) {
      return NextResponse.redirect(attachment.filePath);
    }

    // For WebDAV or filesystem, read and serve the file
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
      console.error("Error reading file:", error);
      // For filesystem, check if file exists
      if (!isWebDAV && !isBlobUrl) {
        const filePath = getAttachmentFilePath(attachment.filePath);
        if (!existsSync(filePath)) {
          return NextResponse.json({ error: "File not found on disk" }, { status: 404 });
        }
      }
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }
  } catch (error) {
    console.error("Error serving file:", error);
    return NextResponse.json(
      { error: "Failed to serve file" },
      { status: 500 }
    );
  }
}

