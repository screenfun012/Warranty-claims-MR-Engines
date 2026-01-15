/**
 * File storage utilities
 * Supports both filesystem (dev/local) and Vercel Blob (production)
 * Automatically detects which storage to use based on BLOB_READ_WRITE_TOKEN env var
 */

import { promises as fs } from "fs";
import path from "path";
import { env } from "@/lib/config/env";
import { prisma } from "@/lib/db/prisma";
import type { Claim } from "@prisma/client";
import { sanitizeClaimCodeForPath } from "@/lib/domain/claimCode";
import { put, del, list } from "@vercel/blob";

// Check if we should use Blob storage
const USE_BLOB = !!env.BLOB_READ_WRITE_TOKEN;

/**
 * Get the base path/key for a claim's files
 * Returns: <claimYear or "unknown">/<sanitizedClaimCode or claim.id>/
 */
function getClaimBaseKey(claim: Claim): string {
  const yearDir = claim.claimYear?.toString() || "unknown";
  const claimDir = claim.claimCodeRaw
    ? sanitizeClaimCodeForPath(claim.claimCodeRaw)
    : claim.id;
  return `${yearDir}/${claimDir}`;
}

/**
 * Get the base path for a claim's files (filesystem only)
 */
export function getClaimBasePath(claim: Claim): string {
  const rootPath = path.resolve(env.FILE_ROOT_PATH);
  const yearDir = claim.claimYear?.toString() || "unknown";
  const claimDir = claim.claimCodeRaw
    ? sanitizeClaimCodeForPath(claim.claimCodeRaw)
    : claim.id;
  return path.join(rootPath, yearDir, claimDir);
}

/**
 * Get the base path/key for unassigned email threads
 */
function getUnassignedThreadKey(threadId: string): string {
  return `_unassigned/${threadId}`;
}

/**
 * Get the base path for unassigned email threads (filesystem only)
 */
export function getUnassignedThreadPath(threadId: string): string {
  const rootPath = path.resolve(env.FILE_ROOT_PATH);
  return path.join(rootPath, "_unassigned", threadId);
}

/**
 * Ensure a directory exists, creating it if necessary (filesystem only)
 */
async function ensureDir(dirPath: string): Promise<void> {
  if (USE_BLOB) return; // Not needed for Blob
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
  }
}

/**
 * Save an attachment file for a claim
 * @param params - Attachment parameters
 * @returns Blob URL (if using Blob) or relative file path (if using filesystem)
 */
export async function saveAttachmentForClaim(params: {
  claim?: Claim;
  claimId?: string;
  fileBuffer: Buffer;
  originalFileName: string;
  mimeType: string;
  subfolder?: string; // e.g. "03_attachments", "01_photos"
}): Promise<string> {
  let claim: Claim | null = null;

  if (params.claim) {
    claim = params.claim;
  } else if (params.claimId) {
    claim = await prisma.claim.findUnique({
      where: { id: params.claimId },
    });
    if (!claim) {
      throw new Error(`Claim not found: ${params.claimId}`);
    }
  } else {
    throw new Error("Either claim or claimId must be provided");
  }

  // Sanitize filename
  const sanitizedFileName = params.originalFileName
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_");

  if (USE_BLOB) {
    // Use Vercel Blob
    const baseKey = getClaimBaseKey(claim);
    const subfolder = params.subfolder || "03_attachments";
    const blobKey = `${baseKey}/${subfolder}/${sanitizedFileName}`;

    // Check if blob already exists and make unique if needed
    let finalKey = blobKey;
    let counter = 1;
    try {
      const existing = await list({
        prefix: `${baseKey}/${subfolder}/`,
        token: env.BLOB_READ_WRITE_TOKEN,
      });
      const existingNames = existing.blobs.map(b => b.pathname.split('/').pop() || '');
      while (existingNames.includes(finalKey.split('/').pop() || '')) {
        const ext = path.extname(sanitizedFileName);
        const name = path.basename(sanitizedFileName, ext);
        finalKey = `${baseKey}/${subfolder}/${name}_${counter}${ext}`;
        counter++;
      }
    } catch (error) {
      // If list fails, just try to upload (will fail if duplicate)
      console.warn("Could not check for existing blobs:", error);
    }

    const blob = await put(finalKey, params.fileBuffer, {
      access: "public",
      contentType: params.mimeType,
      token: env.BLOB_READ_WRITE_TOKEN,
    });

    return blob.url; // Return Blob URL
  } else {
    // Use filesystem
    const basePath = getClaimBasePath(claim);
    const subfolder = params.subfolder || "03_attachments";
    const targetDir = path.join(basePath, subfolder);

    await ensureDir(targetDir);

    // Ensure unique filename if file exists
    let filePath = path.join(targetDir, sanitizedFileName);
    let counter = 1;
    while (await fileExists(filePath)) {
      const ext = path.extname(sanitizedFileName);
      const name = path.basename(sanitizedFileName, ext);
      filePath = path.join(targetDir, `${name}_${counter}${ext}`);
      counter++;
    }

    await fs.writeFile(filePath, params.fileBuffer);

    // Return relative path from FILE_ROOT_PATH
    const relativePath = path.relative(path.resolve(env.FILE_ROOT_PATH), filePath);
    return relativePath;
  }
}

/**
 * Save an attachment for an unassigned email thread
 */
export async function saveAttachmentForUnassignedThread(params: {
  threadId: string;
  fileBuffer: Buffer;
  originalFileName: string;
  mimeType: string;
}): Promise<string> {
  const sanitizedFileName = params.originalFileName
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_");

  if (USE_BLOB) {
    // Use Vercel Blob
    const baseKey = getUnassignedThreadKey(params.threadId);
    const blobKey = `${baseKey}/${sanitizedFileName}`;

    // Check if blob already exists and make unique if needed
    let finalKey = blobKey;
    let counter = 1;
    try {
      const existing = await list({
        prefix: `${baseKey}/`,
        token: env.BLOB_READ_WRITE_TOKEN,
      });
      const existingNames = existing.blobs.map(b => b.pathname.split('/').pop() || '');
      while (existingNames.includes(finalKey.split('/').pop() || '')) {
        const ext = path.extname(sanitizedFileName);
        const name = path.basename(sanitizedFileName, ext);
        finalKey = `${baseKey}/${name}_${counter}${ext}`;
        counter++;
      }
    } catch (error) {
      console.warn("Could not check for existing blobs:", error);
    }

    const blob = await put(finalKey, params.fileBuffer, {
      access: "public",
      contentType: params.mimeType,
      token: env.BLOB_READ_WRITE_TOKEN,
    });

    return blob.url; // Return Blob URL
  } else {
    // Use filesystem
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

    const relativePath = path.relative(path.resolve(env.FILE_ROOT_PATH), filePath);
    return relativePath;
  }
}

/**
 * Get the absolute file path for an attachment (filesystem only)
 * For Blob, this returns the URL as-is
 */
export function getAttachmentFilePath(relativePathOrUrl: string): string {
  if (USE_BLOB || relativePathOrUrl.startsWith('http://') || relativePathOrUrl.startsWith('https://')) {
    // It's a Blob URL, return as-is
    return relativePathOrUrl;
  }
  return path.resolve(env.FILE_ROOT_PATH, relativePathOrUrl);
}

/**
 * Check if a file exists (filesystem only)
 */
async function fileExists(filePath: string): Promise<boolean> {
  if (USE_BLOB) return false; // Not applicable for Blob
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read a file by its relative path or Blob URL
 * Returns Buffer for both filesystem and Blob
 */
export async function readAttachmentFile(relativePathOrUrl: string): Promise<Buffer> {
  if (USE_BLOB || relativePathOrUrl.startsWith('http://') || relativePathOrUrl.startsWith('https://')) {
    // It's a Blob URL
    const response = await fetch(relativePathOrUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch blob: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } else {
    // It's a filesystem path
    const absolutePath = getAttachmentFilePath(relativePathOrUrl);
    return await fs.readFile(absolutePath);
  }
}

/**
 * Delete a file by its relative path or Blob URL
 */
export async function deleteAttachmentFile(relativePathOrUrl: string): Promise<void> {
  if (USE_BLOB || relativePathOrUrl.startsWith('http://') || relativePathOrUrl.startsWith('https://')) {
    // It's a Blob URL - extract key from URL
    try {
      const url = new URL(relativePathOrUrl);
      // Vercel Blob URLs are like: https://xxx.public.blob.vercel-storage.com/path/to/file
      // We need to extract the path part
      const pathname = url.pathname;
      await del(pathname, { token: env.BLOB_READ_WRITE_TOKEN });
    } catch (error) {
      // If blob doesn't exist, that's okay
      console.warn("Could not delete blob:", error);
    }
  } else {
    // It's a filesystem path
    const absolutePath = getAttachmentFilePath(relativePathOrUrl);
    try {
      await fs.unlink(absolutePath);
    } catch (error) {
      // If file doesn't exist, that's okay - just log it
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }
}
