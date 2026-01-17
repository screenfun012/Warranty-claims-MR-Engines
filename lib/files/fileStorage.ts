/**
 * File storage utilities
 * Supports filesystem (dev/local), Vercel Blob (production), and WebDAV (Synology)
 * Priority: WebDAV > Blob > Filesystem
 * Automatically detects which storage to use based on env vars
 */

import { promises as fs } from "fs";
import path from "path";
import { env } from "@/lib/config/env";
import { getPrisma } from "@/lib/db/prisma";
import type { Claim } from "@prisma/client";
import { sanitizeClaimCodeForPath } from "@/lib/domain/claimCode";
import { put, del, list } from "@vercel/blob";
import { createClient } from "webdav";
import type { WebDAVClient } from "webdav";
import https from "https";

// Check which storage to use (priority: WebDAV > Blob > Filesystem)
const USE_WEBDAV = !!(env.WEBDAV_URL && env.WEBDAV_USERNAME && env.WEBDAV_PASSWORD);
const USE_BLOB = !USE_WEBDAV && !!env.BLOB_READ_WRITE_TOKEN;

console.log("[FileStorage] Storage configuration:", {
  USE_WEBDAV,
  USE_BLOB,
  hasWebDAVUrl: !!env.WEBDAV_URL,
  hasWebDAVUsername: !!env.WEBDAV_USERNAME,
  hasWebDAVPassword: !!env.WEBDAV_PASSWORD,
  webDAVUrl: env.WEBDAV_URL ? `${env.WEBDAV_URL.substring(0, 20)}...` : "not set",
  webDAVBasePath: env.WEBDAV_BASE_PATH,
  hasBlobToken: !!env.BLOB_READ_WRITE_TOKEN,
});

// Initialize WebDAV client if configured
let webdavClient: WebDAVClient | null = null;
if (USE_WEBDAV) {
  try {
    console.log("[FileStorage] Initializing WebDAV client...");
    
    // Create HTTPS agent that accepts self-signed certificates
    // This is needed when connecting through Nginx proxy with self-signed cert
    const httpsAgent = new https.Agent({
      rejectUnauthorized: false, // Accept self-signed certificate from proxy
    });
    
    webdavClient = createClient(env.WEBDAV_URL, {
      username: env.WEBDAV_USERNAME,
      password: env.WEBDAV_PASSWORD,
      httpsAgent: httpsAgent, // Use custom HTTPS agent
    });
    console.log("[FileStorage] ✓ WebDAV client initialized successfully:", env.WEBDAV_URL);
    console.log("[FileStorage] WebDAV base path:", env.WEBDAV_BASE_PATH);
  } catch (error) {
    console.error("[FileStorage] ✗ Failed to initialize WebDAV client:", error);
    webdavClient = null;
  }
} else {
  console.warn("[FileStorage] ⚠ WebDAV not configured! Missing:", {
    WEBDAV_URL: !env.WEBDAV_URL,
    WEBDAV_USERNAME: !env.WEBDAV_USERNAME,
    WEBDAV_PASSWORD: !env.WEBDAV_PASSWORD,
  });
  if (!USE_BLOB) {
    console.warn("[FileStorage] ⚠ No storage configured! Files will be saved to filesystem (which won't persist on Vercel).");
  }
}

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
 * Ensure a directory exists, creating it if necessary
 */
async function ensureDir(dirPath: string): Promise<void> {
  if (USE_WEBDAV && webdavClient) {
    // For WebDAV, ensure directory exists
    try {
      const webdavPath = `${env.WEBDAV_BASE_PATH}${dirPath.startsWith('/') ? dirPath : '/' + dirPath}`;
      await webdavClient.createDirectory(webdavPath, { recursive: true });
    } catch (error) {
      // Directory might already exist, that's okay
      console.warn("WebDAV directory creation warning:", error);
    }
    return;
  }
  if (USE_BLOB) return; // Not needed for Blob
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
  }
}

/**
 * Get WebDAV path for a file
 */
function getWebDAVPath(relativePath: string): string {
  const cleanPath = relativePath.startsWith('/') ? relativePath : '/' + relativePath;
  return `${env.WEBDAV_BASE_PATH}${cleanPath}`;
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
    const prismaClient = await getPrisma();
    claim = await prismaClient.claim.findUnique({
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

  if (USE_WEBDAV && webdavClient) {
    // Use WebDAV
    const baseKey = getClaimBaseKey(claim);
    const subfolder = params.subfolder || "03_attachments";
    const relativePath = `${baseKey}/${subfolder}/${sanitizedFileName}`;
    const webdavPath = getWebDAVPath(relativePath);

    // Ensure directory exists
    const dirPath = `${baseKey}/${subfolder}`;
    await ensureDir(dirPath);

    // Check if file exists and make unique if needed
    let finalPath = webdavPath;
    let counter = 1;
    try {
      while (await webdavClient.exists(finalPath)) {
        const ext = path.extname(sanitizedFileName);
        const name = path.basename(sanitizedFileName, ext);
        const newRelativePath = `${baseKey}/${subfolder}/${name}_${counter}${ext}`;
        finalPath = getWebDAVPath(newRelativePath);
        counter++;
      }
    } catch (error) {
      console.warn("Could not check for existing WebDAV file:", error);
    }

    // Upload file to WebDAV
    try {
      console.log(`[saveAttachmentForClaim] Uploading ${params.fileBuffer.length} bytes to WebDAV: ${finalPath}`);
      await webdavClient.putFileContents(finalPath, params.fileBuffer, {
        overwrite: false,
        contentLength: params.fileBuffer.length,
      });
      console.log(`[saveAttachmentForClaim] Successfully uploaded file to WebDAV: ${finalPath}`);
    } catch (error) {
      console.error(`[saveAttachmentForClaim] Error uploading to WebDAV ${finalPath}:`, error);
      throw new Error(`Failed to upload file to WebDAV: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Return relative path (we'll use this to identify the file)
    const finalRelativePath = finalPath.replace(env.WEBDAV_BASE_PATH, '').replace(/^\//, '');
    return `webdav:${finalRelativePath}`;
  } else if (USE_BLOB) {
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

  if (USE_WEBDAV && webdavClient) {
    // Use WebDAV
    const baseKey = getUnassignedThreadKey(params.threadId);
    const relativePath = `${baseKey}/${sanitizedFileName}`;
    const webdavPath = getWebDAVPath(relativePath);

    // Ensure directory exists
    await ensureDir(baseKey);

    // Check if file exists and make unique if needed
    let finalPath = webdavPath;
    let counter = 1;
    try {
      while (await webdavClient.exists(finalPath)) {
        const ext = path.extname(sanitizedFileName);
        const name = path.basename(sanitizedFileName, ext);
        const newRelativePath = `${baseKey}/${name}_${counter}${ext}`;
        finalPath = getWebDAVPath(newRelativePath);
        counter++;
      }
    } catch (error) {
      console.warn("Could not check for existing WebDAV file:", error);
    }

    // Upload file to WebDAV
    try {
      console.log(`[saveAttachmentForUnassignedThread] Uploading ${params.fileBuffer.length} bytes to WebDAV: ${finalPath}`);
      await webdavClient.putFileContents(finalPath, params.fileBuffer, {
        overwrite: false,
        contentLength: params.fileBuffer.length,
      });
      console.log(`[saveAttachmentForUnassignedThread] Successfully uploaded file to WebDAV: ${finalPath}`);
    } catch (error) {
      console.error(`[saveAttachmentForUnassignedThread] Error uploading to WebDAV ${finalPath}:`, error);
      throw new Error(`Failed to upload file to WebDAV: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Return relative path
    const finalRelativePath = finalPath.replace(env.WEBDAV_BASE_PATH, '').replace(/^\//, '');
    return `webdav:${finalRelativePath}`;
  } else if (USE_BLOB) {
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
 * For Blob/WebDAV, this returns the identifier as-is
 */
export function getAttachmentFilePath(relativePathOrUrl: string): string {
  if (relativePathOrUrl.startsWith('webdav:')) {
    // It's a WebDAV path, return as-is
    return relativePathOrUrl;
  }
  if (USE_BLOB || relativePathOrUrl.startsWith('http://') || relativePathOrUrl.startsWith('https://')) {
    // It's a Blob URL, return as-is
    return relativePathOrUrl;
  }
  return path.resolve(env.FILE_ROOT_PATH, relativePathOrUrl);
}

/**
 * Check if a file exists
 */
async function fileExists(filePath: string): Promise<boolean> {
  if (USE_WEBDAV && webdavClient) {
    try {
      return await webdavClient.exists(filePath);
    } catch {
      return false;
    }
  }
  if (USE_BLOB) return false; // Not applicable for Blob
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read a file by its relative path, Blob URL, or WebDAV path
 * Returns Buffer for all storage types
 */
export async function readAttachmentFile(relativePathOrUrl: string): Promise<Buffer> {
  if (relativePathOrUrl.startsWith('webdav:')) {
    // It's a WebDAV path
    if (!webdavClient) {
      console.error("[readAttachmentFile] WebDAV client not initialized. Check WEBDAV_URL, WEBDAV_USERNAME, WEBDAV_PASSWORD env vars.");
      throw new Error("WebDAV client not initialized. Please check WebDAV configuration.");
    }
    const relativePath = relativePathOrUrl.replace('webdav:', '');
    const webdavPath = getWebDAVPath(relativePath);
    console.log(`[readAttachmentFile] Reading WebDAV file: ${webdavPath} (relative: ${relativePath})`);
    
    try {
      // Check if file exists first
      const exists = await webdavClient.exists(webdavPath);
      if (!exists) {
        console.error(`[readAttachmentFile] File does not exist on WebDAV: ${webdavPath}`);
        throw new Error(`File not found on WebDAV: ${webdavPath}`);
      }
      
      const buffer = await webdavClient.getFileContents(webdavPath, { format: 'binary' });
      console.log(`[readAttachmentFile] Successfully read ${Buffer.from(buffer as ArrayBuffer).length} bytes from WebDAV`);
      return Buffer.from(buffer as ArrayBuffer);
    } catch (error) {
      console.error(`[readAttachmentFile] Error reading WebDAV file ${webdavPath}:`, error);
      throw new Error(`Failed to read file from WebDAV: ${error instanceof Error ? error.message : String(error)}`);
    }
  } else if (USE_BLOB || relativePathOrUrl.startsWith('http://') || relativePathOrUrl.startsWith('https://')) {
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
 * Delete a file by its relative path, Blob URL, or WebDAV path
 */
export async function deleteAttachmentFile(relativePathOrUrl: string): Promise<void> {
  if (relativePathOrUrl.startsWith('webdav:')) {
    // It's a WebDAV path
    if (!webdavClient) {
      throw new Error("WebDAV client not initialized");
    }
    try {
      const webdavPath = getWebDAVPath(relativePathOrUrl.replace('webdav:', ''));
      await webdavClient.deleteFile(webdavPath);
    } catch (error) {
      // If file doesn't exist, that's okay
      console.warn("Could not delete WebDAV file:", error);
    }
  } else if (USE_BLOB || relativePathOrUrl.startsWith('http://') || relativePathOrUrl.startsWith('https://')) {
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
