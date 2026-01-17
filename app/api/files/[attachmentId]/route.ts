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
      console.log(`[files/${attachmentId}] Reading file: ${attachment.filePath} (isWebDAV: ${isWebDAV}, isBlobUrl: ${isBlobUrl})`);
      const fileBuffer = await readAttachmentFile(attachment.filePath);
      console.log(`[files/${attachmentId}] Successfully read ${fileBuffer.length} bytes`);
      return new NextResponse(new Uint8Array(fileBuffer), {
        headers: {
          "Content-Type": attachment.mimeType,
          "Content-Disposition": `inline; filename="${attachment.fileName}"`,
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    } catch (error) {
      console.error(`[files/${attachmentId}] Error reading file ${attachment.filePath}:`, error);
      // For filesystem, check if file exists
      if (!isWebDAV && !isBlobUrl) {
        const filePath = getAttachmentFilePath(attachment.filePath);
        if (!existsSync(filePath)) {
          console.error(`[files/${attachmentId}] File not found on disk: ${filePath}`);
          return NextResponse.json({ error: "File not found on disk" }, { status: 404 });
        }
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[files/${attachmentId}] Failed to read file: ${errorMessage}`);
      return NextResponse.json({ 
        error: "File not found", 
        details: errorMessage,
        filePath: attachment.filePath 
      }, { status: 404 });
    }
  } catch (error) {
    console.error("Error serving file:", error);
    return NextResponse.json(
      { error: "Failed to serve file" },
      { status: 500 }
    );
  }
}

