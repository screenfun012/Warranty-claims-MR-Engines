/**
 * File storage utilities
 * Handles saving attachments and organizing files by claim
 */

import { promises as fs } from "fs";
import path from "path";
import { env } from "@/lib/config/env";
import { prisma } from "@/lib/db/prisma";
import type { Claim } from "@prisma/client";
import { sanitizeClaimCodeForPath } from "@/lib/domain/claimCode";

/**
 * Get the base path for a claim's files
 * Returns FILE_ROOT_PATH/<claimYear or "unknown">/<sanitizedClaimCode or claim.id>/
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
 * Get the base path for unassigned email threads
 */
export function getUnassignedThreadPath(threadId: string): string {
  const rootPath = path.resolve(env.FILE_ROOT_PATH);
  return path.join(rootPath, "_unassigned", threadId);
}

/**
 * Ensure a directory exists, creating it if necessary
 */
async function ensureDir(dirPath: string): Promise<void> {
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
  }
}

/**
 * Save an attachment file for a claim
 * @param params - Attachment parameters
 * @returns Relative file path (for Attachment.filePath)
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

  const basePath = getClaimBasePath(claim);
  const subfolder = params.subfolder || "03_attachments";
  const targetDir = path.join(basePath, subfolder);

  await ensureDir(targetDir);

  // Sanitize filename
  const sanitizedFileName = params.originalFileName
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_");

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

/**
 * Save an attachment for an unassigned email thread
 */
export async function saveAttachmentForUnassignedThread(params: {
  threadId: string;
  fileBuffer: Buffer;
  originalFileName: string;
  mimeType: string;
}): Promise<string> {
  const basePath = getUnassignedThreadPath(params.threadId);
  await ensureDir(basePath);

  const sanitizedFileName = params.originalFileName
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_");

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

/**
 * Get the absolute file path for an attachment
 */
export function getAttachmentFilePath(relativePath: string): string {
  return path.resolve(env.FILE_ROOT_PATH, relativePath);
}

/**
 * Check if a file exists
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read a file by its relative path
 */
export async function readAttachmentFile(relativePath: string): Promise<Buffer> {
  const absolutePath = getAttachmentFilePath(relativePath);
  return await fs.readFile(absolutePath);
}

/**
 * Delete a file by its relative path
 */
export async function deleteAttachmentFile(relativePath: string): Promise<void> {
  const absolutePath = getAttachmentFilePath(relativePath);
  try {
    await fs.unlink(absolutePath);
  } catch (error) {
    // If file doesn't exist, that's okay - just log it
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
}

