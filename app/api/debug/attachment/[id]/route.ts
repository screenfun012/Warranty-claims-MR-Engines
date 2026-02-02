/**
 * Debug endpoint to check attachment status
 * GET /api/debug/attachment/[id]
 */

import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db/prisma";
import { env } from "@/lib/config/env";
import { createClient } from "webdav";
import https from "https";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const prisma = await getPrisma();

    // 1. Check if attachment exists in database
    const attachment = await prisma.attachment.findUnique({
      where: { id },
      include: {
        claim: { select: { id: true, claimCodeRaw: true } },
        emailMessage: { select: { id: true, subject: true } },
      },
    });

    if (!attachment) {
      return NextResponse.json({
        status: "NOT_FOUND_IN_DB",
        error: `Attachment ${id} does not exist in database`,
      }, { status: 404 });
    }

    // 2. Check storage configuration
    const hasWebDAV = !!(env.WEBDAV_URL && env.WEBDAV_USERNAME && env.WEBDAV_PASSWORD);
    const isWebDAVPath = attachment.filePath.startsWith('webdav:');
    const isRemoteUrl = attachment.filePath.startsWith('http://') || attachment.filePath.startsWith('https://');

    const result: Record<string, unknown> = {
      attachmentId: id,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      filePath: attachment.filePath,
      fileSize: attachment.fileSize,
      claimId: attachment.claimId,
      claim: attachment.claim,
      emailMessageId: attachment.emailMessageId,
      createdAt: attachment.createdAt,
      storage: {
        webdavConfigured: hasWebDAV,
        isWebDAVPath,
        isRemoteUrl,
        webdavUrl: hasWebDAV ? `${env.WEBDAV_URL.substring(0, 40)}...` : "not configured",
        webdavBasePath: env.WEBDAV_BASE_PATH,
      },
    };

    // 3. Check if file exists on storage
    if (isWebDAVPath && hasWebDAV) {
      try {
        const httpsAgent = new https.Agent({ rejectUnauthorized: false, timeout: 10000 });
        const client = createClient(env.WEBDAV_URL, {
          username: env.WEBDAV_USERNAME,
          password: env.WEBDAV_PASSWORD,
          httpsAgent,
        });

        const relativePath = attachment.filePath.replace('webdav:', '');
        const webdavPath = `${env.WEBDAV_BASE_PATH}/${relativePath}`.replace(/\/+/g, '/');
        
        result.webdavFullPath = webdavPath;
        
        const exists = await client.exists(webdavPath);
        result.fileExistsOnNAS = exists;

        if (!exists) {
          result.status = "FILE_NOT_FOUND_ON_NAS";
          result.error = `File does not exist at path: ${webdavPath}`;
        } else {
          result.status = "OK";
          // Try to get file stats
          try {
            const stat = await client.stat(webdavPath);
            result.fileStats = stat;
          } catch (statErr) {
            result.fileStatsError = statErr instanceof Error ? statErr.message : String(statErr);
          }
        }
      } catch (webdavErr) {
        result.status = "WEBDAV_ERROR";
        result.webdavError = webdavErr instanceof Error ? webdavErr.message : String(webdavErr);
        result.webdavStack = webdavErr instanceof Error ? webdavErr.stack : undefined;
      }
    } else if (isWebDAVPath && !hasWebDAV) {
      result.status = "WEBDAV_NOT_CONFIGURED";
      result.error = "Attachment has webdav: path but WebDAV is not configured on this server";
    } else if (isRemoteUrl) {
      result.status = "REMOTE_URL";
      // Try to fetch headers
      try {
        const resp = await fetch(attachment.filePath, { method: 'HEAD' });
        result.remoteUrlStatus = resp.status;
        result.remoteUrlOk = resp.ok;
      } catch (fetchErr) {
        result.remoteUrlError = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
      }
    } else {
      result.status = "LOCAL_FILESYSTEM";
      result.localPath = `${env.FILE_ROOT_PATH}/${attachment.filePath}`;
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("[debug/attachment] Error:", error);
    return NextResponse.json({
      status: "ERROR",
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}
