/**
 * API route for serving attachment files
 * GET /api/files/[attachmentId]
 * Storage: Synology (WebDAV) or local filesystem.
 * Auth: same pattern as other API routes (getSession from next context) so it works on live.
 */

import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db/prisma";
import { readAttachmentFile, getAttachmentFilePath } from "@/lib/files/fileStorage";
import { existsSync } from "fs";
import { getSession } from "@/lib/auth/get-session";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ attachmentId: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { attachmentId } = await params;

    const prisma = await getPrisma();
    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
    });

    if (!attachment) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
    }

    const isWebDAV = attachment.filePath.startsWith('webdav:');
    const isRemoteUrl = attachment.filePath.startsWith('http://') || attachment.filePath.startsWith('https://');

    if (isRemoteUrl) {
      return NextResponse.redirect(attachment.filePath);
    }

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
      console.error(`[files/${attachmentId}] Error reading file ${attachment.filePath}:`, error);
      // For filesystem, check if file exists
      if (!isWebDAV && !isRemoteUrl) {
        const filePath = getAttachmentFilePath(attachment.filePath);
        if (!existsSync(filePath)) {
          console.error(`[files/${attachmentId}] File not found on disk: ${filePath}`);
          return NextResponse.json({
            error: "File not found on disk",
            code: "FILE_NOT_ON_DISK",
            filePath: attachment.filePath,
          }, { status: 404 });
        }
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[files/${attachmentId}] Failed to read file: ${errorMessage}`);
      const isNasNotFound = /not found on NAS|File not found on NAS/i.test(errorMessage);
      return NextResponse.json({
        error: isNasNotFound ? "File not found on storage (NAS). It may not have been synced or may have been moved." : "File not found",
        code: isNasNotFound ? "FILE_NOT_ON_NAS" : "FILE_NOT_FOUND",
        details: errorMessage,
        filePath: attachment.filePath,
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

