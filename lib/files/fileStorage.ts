/**
 * File storage — Synology NAS (WebDAV) only. Fallback: local filesystem for dev.
 * No Blob. Everything goes to NAS when WebDAV is configured.
 */

import { promises as fs } from "fs";
import path from "path";
import { env } from "@/lib/config/env";
import { getPrisma } from "@/lib/db/prisma";
import type { Claim } from "@prisma/client";
import { sanitizeClaimCodeForPath, sanitizeCustomerNameForPath } from "@/lib/domain/claimCode";
import { createClient } from "webdav";
import type { WebDAVClient } from "webdav";
import https from "https";

const USE_WEBDAV = !!(env.WEBDAV_URL && env.WEBDAV_USERNAME && env.WEBDAV_PASSWORD);

console.log("[FileStorage] Storage: Synology (WebDAV) only.", {
  USE_WEBDAV,
  webDAVUrl: env.WEBDAV_URL ? `${env.WEBDAV_URL.substring(0, 24)}...` : "not set",
  webDAVBasePath: env.WEBDAV_BASE_PATH,
});

let webdavClient: WebDAVClient | null = null;
if (USE_WEBDAV) {
  try {
    const httpsAgent = new https.Agent({ 
      rejectUnauthorized: false,
      timeout: 30000, // 30s timeout
    });
    webdavClient = createClient(env.WEBDAV_URL, {
      username: env.WEBDAV_USERNAME,
      password: env.WEBDAV_PASSWORD,
      httpsAgent,
      maxBodyLength: 100 * 1024 * 1024, // 100MB
      maxContentLength: 100 * 1024 * 1024, // 100MB
    });
    console.log("[FileStorage] ✓ WebDAV (Synology via proxy) initialized", {
      url: env.WEBDAV_URL.substring(0, 30) + "...",
      basePath: env.WEBDAV_BASE_PATH,
    });
  } catch (error) {
    console.error("[FileStorage] ✗ WebDAV init failed:", error);
    webdavClient = null;
  }
} else {
  console.warn("[FileStorage] ⚠ WebDAV not configured. Using local filesystem (dev only).");
}

async function getClaimBaseKey(claim: Claim & { customer?: { name: string | null; company?: string | null } | null }): Promise<string> {
  let companyName: string | null = null;
  if (claim.customer) {
    companyName = claim.customer.company || claim.customer.name;
  } else if (claim.customerId) {
    try {
      const prismaClient = await getPrisma();
      const customer = await prismaClient.customer.findUnique({
        where: { id: claim.customerId },
        select: { name: true, company: true },
      });
      companyName = customer?.company || customer?.name || null;
    } catch (error) {
      console.warn(`[getClaimBaseKey] Failed to load customer for claim ${claim.id}:`, error);
    }
  }
  const sanitizedCompanyName = sanitizeCustomerNameForPath(companyName);
  const sanitizedClaimCode = claim.claimCodeRaw
    ? sanitizeClaimCodeForPath(claim.claimCodeRaw)
    : claim.id;
  return `${sanitizedCompanyName} - ${sanitizedClaimCode}`;
}

/**
 * Returns true when claim has both Firma (customer name/company) and MR Code.
 * Only then do we create a "Firma - MR Code" folder on NAS. Before that, attachments go to _unassigned.
 */
export async function claimHasProperFolderMetadata(claim: Claim & { customer?: { name: string | null; company?: string | null } | null }): Promise<boolean> {
  if (!claim.claimCodeRaw || !claim.claimCodeRaw.trim()) return false;
  const baseKey = await getClaimBaseKey(claim);
  return !baseKey.startsWith("Unknown -");
}

export async function getClaimBasePath(claim: Claim & { customer?: { name: string | null } | null }): Promise<string> {
  const rootPath = path.resolve(env.FILE_ROOT_PATH);
  const baseKey = await getClaimBaseKey(claim);
  return path.join(rootPath, baseKey);
}

function getUnassignedThreadKey(threadId: string): string {
  return `_unassigned/${threadId}`;
}

export function getUnassignedThreadPath(threadId: string): string {
  const rootPath = path.resolve(env.FILE_ROOT_PATH);
  return path.join(rootPath, "_unassigned", threadId);
}

async function ensureDir(dirPath: string): Promise<void> {
  if (USE_WEBDAV && webdavClient) {
    try {
      const webdavPath = `${env.WEBDAV_BASE_PATH}${dirPath.startsWith('/') ? dirPath : '/' + dirPath}`;
      await webdavClient.createDirectory(webdavPath, { recursive: true });
    } catch (error) {
      console.warn("WebDAV directory creation warning:", error);
    }
    return;
  }
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
  }
}

function getWebDAVPath(relativePath: string): string {
  const cleanPath = relativePath.startsWith('/') ? relativePath : '/' + relativePath;
  return `${env.WEBDAV_BASE_PATH}${cleanPath}`;
}

export async function createClaimFolder(claim: Claim & { customer?: { name: string | null; company?: string | null } | null }): Promise<string | null> {
  const hasProper = await claimHasProperFolderMetadata(claim);
  if (!hasProper) {
    console.log(`[createClaimFolder] Skipping: claim ${claim.id} has no Firma+MR Code yet, no folder created`);
    return null;
  }
  const baseKey = await getClaimBaseKey(claim);
  console.log(`[createClaimFolder] Creating folder for claim ${claim.id}: ${baseKey}`);

  if (USE_WEBDAV && webdavClient) {
    try {
      await ensureDir(baseKey);
      for (const subfolder of ['01_photos', '02_documents', '03_attachments', '04_reports']) {
        await ensureDir(`${baseKey}/${subfolder}`);
      }
      console.log(`[createClaimFolder] Created on Synology: ${baseKey}`);
      return baseKey;
    } catch (error) {
      console.error(`[createClaimFolder] Error:`, error);
      return null;
    }
  }
  try {
    const rootPath = path.resolve(env.FILE_ROOT_PATH);
    const basePath = path.join(rootPath, baseKey);
    await ensureDir(baseKey);
    for (const subfolder of ['01_photos', '02_documents', '03_attachments', '04_reports']) {
      await ensureDir(`${baseKey}/${subfolder}`);
    }
    return basePath;
  } catch (error) {
    console.error(`[createClaimFolder] Error (filesystem):`, error);
    return null;
  }
}

export type MoveUnassignedResult = {
  moved: number;
  failed: number;
  errors: Array<{ attachmentId: string; fileName: string; error: string }>;
};

/**
 * Moves all attachments from _unassigned into the claim folder (Firma - MR Code/03_attachments),
 * updates filePath in DB, and removes emptied _unassigned/threadId folders.
 * Call after createClaimFolder when Firma+MR Code are first set.
 */
export async function moveAttachmentsFromUnassignedToClaim(
  claim: Claim & { customer?: { name: string | null; company?: string | null } | null }
): Promise<MoveUnassignedResult> {
  const prisma = await getPrisma();
  const hasProper = await claimHasProperFolderMetadata(claim);
  if (!hasProper) {
    return { moved: 0, failed: 0, errors: [] };
  }

  // Attachments linked to this claim (via claimId or email thread) with _unassigned path
  const threads = await prisma.emailThread.findMany({
    where: { claimId: claim.id },
    select: { id: true },
  });
  const threadIds = new Set(threads.map((t) => t.id));

  const attachments = await prisma.attachment.findMany({
    where: {
      OR: [
        { claimId: claim.id },
        {
          emailMessage: {
            emailThreadId: { in: Array.from(threadIds) },
          },
        },
      ],
      filePath: { contains: "_unassigned" },
    },
  });

  if (attachments.length === 0) {
    return { moved: 0, failed: 0, errors: [] };
  }

  const baseKey = await getClaimBaseKey(claim);
  const targetSubfolder = `${baseKey}/03_attachments`;
  await ensureDir(targetSubfolder);

  const result: MoveUnassignedResult = { moved: 0, failed: 0, errors: [] };
  const movedFromThreads = new Set<string>();

  for (const att of attachments) {
    const fp = att.filePath || "";
    if (!fp.includes("_unassigned")) continue;

    let sourceRelative: string;
    if (fp.startsWith("webdav:")) {
      sourceRelative = fp.replace("webdav:", "").replace(/^\//, "");
    } else {
      sourceRelative = fp;
    }

    const match = sourceRelative.match(/^_unassigned\/([^/]+)\/(.+)$/);
    if (!match) continue;
    const [, threadId, fileName] = match;
    movedFromThreads.add(threadId);

    if (USE_WEBDAV && webdavClient) {
      const sourceWebDav = getWebDAVPath(sourceRelative);
      let destRelative = `${targetSubfolder}/${path.basename(fileName)}`;
      let destWebDav = getWebDAVPath(destRelative);
      let counter = 1;
      try {
        while (await webdavClient.exists(destWebDav)) {
          const ext = path.extname(fileName);
          const name = path.basename(fileName, ext);
          destRelative = `${targetSubfolder}/${name}_${counter}${ext}`;
          destWebDav = getWebDAVPath(destRelative);
          counter++;
        }

        const exists = await webdavClient.exists(sourceWebDav);
        if (!exists) {
          result.failed++;
          result.errors.push({
            attachmentId: att.id,
            fileName: att.fileName,
            error: "File not found on NAS (cannot move)",
          });
          continue;
        }

        await webdavClient.moveFile(sourceWebDav, destWebDav, { overwrite: false });
        const newFilePath = `webdav:${destRelative}`;
        await prisma.attachment.update({
          where: { id: att.id },
          data: { filePath: newFilePath, claimId: claim.id },
        });
        result.moved++;
      } catch (err) {
        result.failed++;
        result.errors.push({
          attachmentId: att.id,
          fileName: att.fileName,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    } else {
      // Local filesystem
      const rootPath = path.resolve(env.FILE_ROOT_PATH);
      const sourcePath = path.join(rootPath, sourceRelative);
      let destPath = path.join(rootPath, targetSubfolder, path.basename(fileName));
      let counter = 1;
      try {
        while (await fileExists(destPath)) {
          const ext = path.extname(fileName);
          const name = path.basename(fileName, ext);
          destPath = path.join(rootPath, targetSubfolder, `${name}_${counter}${ext}`);
          counter++;
        }
        await fs.copyFile(sourcePath, destPath);
        await fs.unlink(sourcePath);
        const newFilePath = path.relative(rootPath, destPath);
        await prisma.attachment.update({
          where: { id: att.id },
          data: { filePath: newFilePath, claimId: claim.id },
        });
        result.moved++;
      } catch (err) {
        result.failed++;
        result.errors.push({
          attachmentId: att.id,
          fileName: att.fileName,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  // Remove emptied _unassigned/threadId folders
  for (const threadId of movedFromThreads) {
    const unassignedKey = getUnassignedThreadKey(threadId);
    if (USE_WEBDAV && webdavClient) {
      try {
        const webdavPath = getWebDAVPath(unassignedKey);
        const exists = await webdavClient.exists(webdavPath);
        if (exists) {
          const raw = await webdavClient.getDirectoryContents(webdavPath);
          const contents = Array.isArray(raw) ? raw : (raw as { data?: unknown[] })?.data ?? [];
          if (contents.length === 0) {
            await webdavClient.deleteFile(webdavPath);
          }
        }
      } catch (e) {
        console.warn(`[moveAttachmentsFromUnassigned] Could not remove empty _unassigned folder:`, e);
      }
    } else {
      try {
        const dirPath = path.join(path.resolve(env.FILE_ROOT_PATH), "_unassigned", threadId);
        const entries = await fs.readdir(dirPath);
        if (entries.length === 0) {
          await fs.rmdir(dirPath);
        }
      } catch {
        // ignore
      }
    }
  }

  if (result.moved > 0) {
    console.log(`[moveAttachmentsFromUnassigned] Moved ${result.moved} attachments for claim ${claim.id}`);
  }
  return result;
}

export async function saveAttachmentForClaim(params: {
  claim?: Claim;
  claimId?: string;
  fileBuffer: Buffer;
  originalFileName: string;
  mimeType: string;
  subfolder?: string;
}): Promise<string> {
  let claim: Claim | null = null;
  if (params.claim) {
    claim = params.claim;
  } else if (params.claimId) {
    const prismaClient = await getPrisma();
    claim = await prismaClient.claim.findUnique({ where: { id: params.claimId } });
    if (!claim) throw new Error(`Claim not found: ${params.claimId}`);
  } else {
    throw new Error("Either claim or claimId must be provided");
  }

  const sanitizedFileName = params.originalFileName
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_");
  const subfolder = params.subfolder || "03_attachments";

  if (USE_WEBDAV && webdavClient) {
    const baseKey = await getClaimBaseKey(claim);
    const relativePath = `${baseKey}/${subfolder}/${sanitizedFileName}`;
    const webdavPath = getWebDAVPath(relativePath);
    await ensureDir(`${baseKey}/${subfolder}`);

    let finalPath = webdavPath;
    let counter = 1;
    try {
      while (await webdavClient.exists(finalPath)) {
        const ext = path.extname(sanitizedFileName);
        const name = path.basename(sanitizedFileName, ext);
        finalPath = getWebDAVPath(`${baseKey}/${subfolder}/${name}_${counter}${ext}`);
        counter++;
      }
    } catch (error) {
      console.warn("Could not check for existing WebDAV file:", error);
    }

    await webdavClient.putFileContents(finalPath, params.fileBuffer, {
      overwrite: false,
      contentLength: params.fileBuffer.length,
    });
    const finalRelativePath = finalPath.replace(env.WEBDAV_BASE_PATH, '').replace(/^\//, '');
    return `webdav:${finalRelativePath}`;
  }

  const basePath = await getClaimBasePath(claim);
  const targetDir = path.join(basePath, subfolder);
  await ensureDir(targetDir);
  let filePath = path.join(targetDir, sanitizedFileName);
  let counter = 1;
  while (await fileExists(filePath)) {
    const ext = path.extname(sanitizedFileName);
    const name = path.basename(sanitizedFileName, ext);
    filePath = path.join(targetDir, `${name}_${counter}${ext}`);
    counter++;
  }
  await fs.writeFile(filePath, params.fileBuffer);
  return path.relative(path.resolve(env.FILE_ROOT_PATH), filePath);
}

export async function saveAttachmentForUnassignedThread(params: {
  threadId: string;
  fileBuffer: Buffer;
  originalFileName: string;
  mimeType: string;
}): Promise<string> {
  const sanitizedFileName = params.originalFileName
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_");

  if (USE_WEBDAV && webdavClient) {
    const baseKey = getUnassignedThreadKey(params.threadId);
    const relativePath = `${baseKey}/${sanitizedFileName}`;
    const webdavPath = getWebDAVPath(relativePath);
    await ensureDir(baseKey);

    let finalPath = webdavPath;
    let counter = 1;
    try {
      while (await webdavClient.exists(finalPath)) {
        const ext = path.extname(sanitizedFileName);
        const name = path.basename(sanitizedFileName, ext);
        finalPath = getWebDAVPath(`${baseKey}/${name}_${counter}${ext}`);
        counter++;
      }
    } catch (error) {
      console.warn("Could not check for existing WebDAV file:", error);
    }

    await webdavClient.putFileContents(finalPath, params.fileBuffer, {
      overwrite: false,
      contentLength: params.fileBuffer.length,
    });
    const finalRelativePath = finalPath.replace(env.WEBDAV_BASE_PATH, '').replace(/^\//, '');
    return `webdav:${finalRelativePath}`;
  }

  const basePath = getUnassignedThreadPath(params.threadId);
  await ensureDir(basePath);
  let filePath = path.join(basePath, sanitizedFileName);
  let counter = 1;
  while (await fileExists(filePath)) {
    const ext = path.extname(sanitizedFileName);
    const name = path.basename(sanitizedFileName, ext);
    filePath = path.join(basePath, `${name}_${counter}${ext}`);
    counter++;
  }
  await fs.writeFile(filePath, params.fileBuffer);
  return path.relative(path.resolve(env.FILE_ROOT_PATH), filePath);
}

export function getAttachmentFilePath(relativePathOrUrl: string): string {
  if (relativePathOrUrl.startsWith('webdav:')) {
    return relativePathOrUrl;
  }
  if (relativePathOrUrl.startsWith('http://') || relativePathOrUrl.startsWith('https://')) {
    return relativePathOrUrl;
  }
  return path.resolve(env.FILE_ROOT_PATH, relativePathOrUrl);
}

async function fileExists(filePath: string): Promise<boolean> {
  if (USE_WEBDAV && webdavClient) {
    try {
      return await webdavClient.exists(filePath);
    } catch {
      return false;
    }
  }
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function readAttachmentFile(relativePathOrUrl: string): Promise<Buffer> {
  if (relativePathOrUrl.startsWith('webdav:')) {
    if (!webdavClient) {
      console.error("[readAttachmentFile] WebDAV client not initialized", {
        hasUrl: !!env.WEBDAV_URL,
        hasUsername: !!env.WEBDAV_USERNAME,
        hasPassword: !!env.WEBDAV_PASSWORD,
      });
      throw new Error("WebDAV client not initialized. Check WEBDAV_URL, WEBDAV_USERNAME, WEBDAV_PASSWORD.");
    }
    const relativePath = relativePathOrUrl.replace('webdav:', '');
    const webdavPath = getWebDAVPath(relativePath);
    
    console.log("[readAttachmentFile] Reading from WebDAV", { 
      relativePath, 
      webdavPath,
      webdavUrl: env.WEBDAV_URL?.substring(0, 30) + "...",
    });
    
    try {
      const exists = await webdavClient.exists(webdavPath);
      if (!exists) {
        console.error("[readAttachmentFile] File not found on NAS", { webdavPath });
        throw new Error(`File not found on NAS: ${webdavPath}`);
      }
      const buffer = await webdavClient.getFileContents(webdavPath, { format: 'binary' });
      const bufferData = Buffer.from(buffer as ArrayBuffer);
      console.log("[readAttachmentFile] Successfully read file", { 
        webdavPath, 
        size: bufferData.length 
      });
      return bufferData;
    } catch (error) {
      console.error("[readAttachmentFile] WebDAV error", {
        webdavPath,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }
  if (relativePathOrUrl.startsWith('http://') || relativePathOrUrl.startsWith('https://')) {
    const response = await fetch(relativePathOrUrl);
    if (!response.ok) throw new Error(`Failed to fetch file: ${response.statusText}`);
    return Buffer.from(await response.arrayBuffer());
  }
  const absolutePath = getAttachmentFilePath(relativePathOrUrl);
  return await fs.readFile(absolutePath);
}

export async function deleteAttachmentFile(relativePathOrUrl: string): Promise<void> {
  if (relativePathOrUrl.startsWith('webdav:')) {
    if (!webdavClient) return;
    try {
      const webdavPath = getWebDAVPath(relativePathOrUrl.replace('webdav:', ''));
      await webdavClient.deleteFile(webdavPath);
    } catch (error) {
      console.warn("Could not delete WebDAV file:", error);
    }
    return;
  }
  if (relativePathOrUrl.startsWith('http://') || relativePathOrUrl.startsWith('https://')) {
    console.warn("[deleteAttachmentFile] Cannot delete remote URL (no Blob). Skipping.");
    return;
  }
  const absolutePath = getAttachmentFilePath(relativePathOrUrl);
  try {
    await fs.unlink(absolutePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}

export async function deleteClaimFolder(claim: Claim & { customer?: { name: string | null } | null }): Promise<void> {
  const baseKey = await getClaimBaseKey(claim);

  if (USE_WEBDAV && webdavClient) {
    try {
      const webdavPath = getWebDAVPath(baseKey);
      const exists = await webdavClient.exists(webdavPath);
      if (exists) await webdavClient.deleteFile(webdavPath);
    } catch (error) {
      console.error(`[deleteClaimFolder] Error:`, error);
    }
    return;
  }

  try {
    const basePath = await getClaimBasePath(claim);
    await fs.rm(basePath, { recursive: true, force: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error(`[deleteClaimFolder] Error:`, error);
    }
  }
}
