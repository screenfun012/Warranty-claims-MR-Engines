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

type ClaimForFolder = Claim & { customer?: { name: string | null; company?: string | null } | null; isDomesticMarket?: boolean };

async function getClaimBaseKey(claim: ClaimForFolder): Promise<string> {
  let customerName: string | null = null;
  let companyName: string | null = null;
  if (claim.customer) {
    customerName = claim.customer.name ?? null;
    companyName = claim.customer.company ?? null;
  } else if (claim.customerId) {
    try {
      const prismaClient = await getPrisma();
      const customer = await prismaClient.customer.findUnique({
        where: { id: claim.customerId },
        select: { name: true, company: true },
      });
      customerName = customer?.name ?? null;
      companyName = customer?.company ?? null;
    } catch (error) {
      console.warn(`[getClaimBaseKey] Failed to load customer for claim ${claim.id}:`, error);
    }
  }
  const sanitizedClaimCode = claim.claimCodeRaw
    ? sanitizeClaimCodeForPath(claim.claimCodeRaw)
    : claim.id;

  const isDomestic = !!claim.isDomesticMarket;
  if (isDomestic) {
    // Domaće tržište: Ime Kupca (Kompanija Kupca) + MR Code
    const namePart = [customerName?.trim(), companyName?.trim()].filter(Boolean);
    const folderLabel =
      namePart.length === 2
        ? `${namePart[0]} (${namePart[1]})`
        : namePart.length === 1
          ? namePart[0]
          : "Domestic";
    const sanitizedLabel = sanitizeCustomerNameForPath(folderLabel);
    return `${sanitizedLabel} - ${sanitizedClaimCode}`;
  }

  // Strano tržište: Kompanija kupca + MR Code
  const companyOrName = companyName?.trim() || customerName?.trim() || null;
  const sanitizedCompanyName = sanitizeCustomerNameForPath(companyOrName);
  return `${sanitizedCompanyName} - ${sanitizedClaimCode}`;
}

/** "Unknown - MR…" / "Domestic - MR…" — nastaju kad nema imena/firme; ne želimo nove takve foldere. */
function isPlaceholderFolderKey(claim: ClaimForFolder, baseKey: string): boolean {
  const sanitizedCode = claim.claimCodeRaw?.trim()
    ? sanitizeClaimCodeForPath(claim.claimCodeRaw.trim())
    : claim.id;
  return baseKey === `Unknown - ${sanitizedCode}` || baseKey === `Domestic - ${sanitizedCode}`;
}

/**
 * Da li ima smisla praviti "pravi" folder: uvek MR broj + bar ime ili firma (domaće ili strano).
 * Ranije je domaće tržište uvek vraćalo true pa su nastajali "Domestic - …" folderi bez podataka.
 */
export async function claimHasProperFolderMetadata(
  claim: Claim & {
    customer?: { name: string | null; company?: string | null } | null;
    isDomesticMarket?: boolean;
  }
): Promise<boolean> {
  if (!claim.claimCodeRaw?.trim()) {
    return false;
  }

  let customerName: string | null = null;
  let companyName: string | null = null;
  if (claim.customer) {
    customerName = claim.customer.name ?? null;
    companyName = claim.customer.company ?? null;
  } else if (claim.customerId) {
    try {
      const prismaClient = await getPrisma();
      const customer = await prismaClient.customer.findUnique({
        where: { id: claim.customerId },
        select: { name: true, company: true },
      });
      customerName = customer?.name ?? null;
      companyName = customer?.company ?? null;
    } catch {
      return false;
    }
  }

  if (claim.isDomesticMarket) {
    const namePart = [customerName?.trim(), companyName?.trim()].filter(Boolean);
    return namePart.length > 0;
  }

  const companyOrName = companyName?.trim() || customerName?.trim() || null;
  return !!(companyOrName?.trim());
}

/** Pravi ključ za NAS ili privremeni `_pending_claims/<id>` dok korisnik ne popuni metapodatke. */
async function resolveStorageBaseKey(claim: ClaimForFolder): Promise<string> {
  if (await claimHasProperFolderMetadata(claim)) {
    return await getClaimBaseKey(claim);
  }
  console.warn(
    `[resolveStorageBaseKey] Claim ${claim.id}: metadata incomplete — using _pending_claims/${claim.id}`
  );
  return `_pending_claims/${claim.id}`;
}

export async function getClaimBasePath(claim: Claim & { customer?: { name: string | null } | null }): Promise<string> {
  const rootPath = path.resolve(env.FILE_ROOT_PATH);
  const baseKey = await resolveStorageBaseKey(claim);
  return path.join(rootPath, baseKey);
}

function getUnassignedThreadKey(threadId: string): string {
  return `_unassigned/${threadId}`;
}

export function getUnassignedThreadPath(threadId: string): string {
  const rootPath = path.resolve(env.FILE_ROOT_PATH);
  return path.join(rootPath, "_unassigned", threadId);
}

/** Base folder for generic sent mail archive (same root as claims, e.g. REKLAMACIJE area on NAS) */
const SENT_MAIL_ARCHIVE_BASE = "Poslati_mailovi";

/**
 * Raw mail files under WEBDAV_BASE_PATH (WARRANTY root on Synology).
 * inbound: IMAP sync writes full RFC822 .eml
 * outbound: sent mail snapshot .eml
 */
export const EMAILS_STORAGE_ROOT = "Emails";

function toWebdavRef(relativePath: string): string {
  const normalized = relativePath.replace(/^\/+/, "");
  return `webdav:${normalized}`;
}

/**
 * Save inbound IMAP raw source to NAS/local storage. Returns webdav:... or relative path for local.
 */
export async function saveInboundRawEmailToStorage(
  threadId: string,
  emailMessageId: string,
  rawBuffer: Buffer
): Promise<string | null> {
  if (!rawBuffer?.length) return null;
  const safeThread = threadId.replace(/[/\\:*?"<>|]/g, "_");
  const safeMsg = emailMessageId.replace(/[/\\:*?"<>|]/g, "_");
  const relativePath = `${EMAILS_STORAGE_ROOT}/inbound/${safeThread}/${safeMsg}.eml`;
  const dirOnly = `${EMAILS_STORAGE_ROOT}/inbound/${safeThread}`;

  try {
    await ensureDir(dirOnly);
    if (USE_WEBDAV && webdavClient) {
      const fullPath = getWebDAVPath(relativePath);
      await webdavClient.putFileContents(fullPath, rawBuffer, { overwrite: true });
      console.log(`[saveInboundRawEmailToStorage] WebDAV: ${relativePath} (${rawBuffer.length} bytes)`);
      return toWebdavRef(relativePath);
    }
    const localPath = path.join(path.resolve(env.FILE_ROOT_PATH), relativePath);
    await fs.mkdir(path.dirname(localPath), { recursive: true });
    await fs.writeFile(localPath, rawBuffer);
    console.log(`[saveInboundRawEmailToStorage] Local: ${relativePath} (${rawBuffer.length} bytes)`);
    return relativePath;
  } catch (error) {
    console.error(`[saveInboundRawEmailToStorage] Failed:`, error);
    return null;
  }
}

export type OutboundRawMailParams = {
  from: string;
  to: string;
  cc?: string;
  subject: string;
  text?: string;
  html?: string;
  messageId?: string;
  date: Date;
};

function buildOutboundMimeBuffer(params: OutboundRawMailParams): Buffer {
  const nl = "\r\n";
  const subject = (params.subject || "").replace(/\r?\n/g, " ");
  const escapeHeader = (s: string) => s.replace(/\r?\n/g, " ");
  const lines: string[] = [
    `From: ${escapeHeader(params.from)}`,
    `To: ${escapeHeader(params.to)}`,
    ...(params.cc ? [`Cc: ${escapeHeader(params.cc)}`] : []),
    `Subject: ${escapeHeader(subject)}`,
    `Date: ${params.date.toUTCString()}`,
    `MIME-Version: 1.0`,
  ];
  if (params.messageId) {
    lines.push(`Message-ID: ${escapeHeader(params.messageId)}`);
  }
  const text = params.text ?? "";
  const html = params.html ?? "";
  if (html && text) {
    const b = `----BOUND_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    lines.push(`Content-Type: multipart/alternative; boundary="${b}"`);
    lines.push("");
    lines.push(`--${b}`);
    lines.push(`Content-Type: text/plain; charset=UTF-8`);
    lines.push(`Content-Transfer-Encoding: 8bit`);
    lines.push("");
    lines.push(text);
    lines.push(`--${b}`);
    lines.push(`Content-Type: text/html; charset=UTF-8`);
    lines.push(`Content-Transfer-Encoding: 8bit`);
    lines.push("");
    lines.push(html);
    lines.push(`--${b}--`);
  } else if (html) {
    lines.push(`Content-Type: text/html; charset=UTF-8`);
    lines.push(`Content-Transfer-Encoding: 8bit`);
    lines.push("");
    lines.push(html);
  } else {
    lines.push(`Content-Type: text/plain; charset=UTF-8`);
    lines.push(`Content-Transfer-Encoding: 8bit`);
    lines.push("");
    lines.push(text);
  }
  return Buffer.from(lines.join(nl), "utf-8");
}

/**
 * Save outbound sent message as .eml under Emails/outbound/<threadId>/
 */
export async function saveOutboundRawEmailToStorage(
  threadId: string,
  emailMessageId: string,
  params: OutboundRawMailParams
): Promise<string | null> {
  const safeThread = threadId.replace(/[/\\:*?"<>|]/g, "_");
  const safeMsg = emailMessageId.replace(/[/\\:*?"<>|]/g, "_");
  const relativePath = `${EMAILS_STORAGE_ROOT}/outbound/${safeThread}/${safeMsg}.eml`;
  const dirOnly = `${EMAILS_STORAGE_ROOT}/outbound/${safeThread}`;
  const buf = buildOutboundMimeBuffer(params);

  try {
    await ensureDir(dirOnly);
    if (USE_WEBDAV && webdavClient) {
      const fullPath = getWebDAVPath(relativePath);
      await webdavClient.putFileContents(fullPath, buf, { overwrite: true });
      console.log(`[saveOutboundRawEmailToStorage] WebDAV: ${relativePath} (${buf.length} bytes)`);
      return toWebdavRef(relativePath);
    }
    const localPath = path.join(path.resolve(env.FILE_ROOT_PATH), relativePath);
    await fs.mkdir(path.dirname(localPath), { recursive: true });
    await fs.writeFile(localPath, buf);
    return relativePath;
  } catch (error) {
    console.error(`[saveOutboundRawEmailToStorage] Failed:`, error);
    return null;
  }
}

function sanitizeSubjectForFolderName(subject: string): string {
  const s = (subject || "Bez naslova")
    .replace(/[/\\:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  return s.slice(0, 120) || "Bez_naslova";
}

export type SaveSentMailToNasParams = {
  from: string;
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  text?: string;
  html?: string;
  messageId?: string;
  sentAt: Date;
  attachments?: Array<{ filename: string; buffer: Buffer; contentType?: string }>;
};

/**
 * Save a sent (generic) email to NAS under Poslati_mailovi/[subject]/ so we don't fill the DB.
 * Folder name = email subject. Contents: metadata.json, body.html, body.txt, and attachment files.
 * Returns the relative folder path (e.g. Poslati_mailovi/Naslov_maila) for reference.
 */
export async function saveSentMailToNas(params: SaveSentMailToNasParams): Promise<string | null> {
  const folderName = sanitizeSubjectForFolderName(params.subject);
  let relativeDir = `${SENT_MAIL_ARCHIVE_BASE}/${folderName}`;
  let suffix = 0;
  const baseDir = relativeDir;

  const exists = async (p: string): Promise<boolean> => {
    if (USE_WEBDAV && webdavClient) {
      try {
        return await webdavClient.exists(getWebDAVPath(p));
      } catch {
        return false;
      }
    }
    try {
      await fs.access(path.join(path.resolve(env.FILE_ROOT_PATH), p));
      return true;
    } catch {
      return false;
    }
  };

  while (await exists(relativeDir)) {
    suffix++;
    relativeDir = `${baseDir}_${suffix}`;
  }

  await ensureDir(relativeDir);

  const metadata = {
    from: params.from,
    to: params.to,
    cc: params.cc ?? null,
    bcc: params.bcc ?? null,
    subject: params.subject,
    messageId: params.messageId ?? null,
    sentAt: params.sentAt.toISOString(),
  };

  const writeFile = async (relativePath: string, content: Buffer | string): Promise<void> => {
    const buf = typeof content === "string" ? Buffer.from(content, "utf-8") : content;
    if (USE_WEBDAV && webdavClient) {
      const fullPath = getWebDAVPath(`${relativeDir}/${relativePath}`);
      await webdavClient.putFileContents(fullPath, buf, { overwrite: true });
    } else {
      const fullPath = path.join(path.resolve(env.FILE_ROOT_PATH), relativeDir, relativePath);
      await fs.writeFile(fullPath, buf);
    }
  };

  await writeFile("metadata.json", JSON.stringify(metadata, null, 2));
  if (params.text) await writeFile("body.txt", params.text);
  if (params.html) await writeFile("body.html", params.html);

  if (params.attachments?.length) {
    for (let i = 0; i < params.attachments.length; i++) {
      const att = params.attachments[i];
      const safeName = (att.filename || "attachment").replace(/[/\\:*?"<>|]/g, "_");
      const name = params.attachments.length > 1 ? `${String(i + 1).padStart(2, "0")}_${safeName}` : safeName;
      await writeFile(name, att.buffer);
    }
  }

  return relativeDir;
}

export type SentMailFolderInfo = {
  folderName: string;
  path: string;
  subject: string;
  to: string;
  sentAt: string;
};

/**
 * List sent mail folders on NAS (Poslati_mailovi/*). Reads metadata.json from each folder.
 */
export async function listSentMailFolders(): Promise<SentMailFolderInfo[]> {
  const basePath = getWebDAVPath(SENT_MAIL_ARCHIVE_BASE);
  const results: SentMailFolderInfo[] = [];

  if (USE_WEBDAV && webdavClient) {
    try {
      const exists = await webdavClient.exists(basePath);
      if (!exists) return [];
      const contents = await webdavClient.getDirectoryContents(basePath);
      const items = Array.isArray(contents) ? contents : (contents as { data?: unknown[] }).data ?? [];
      for (const item of items) {
        const entry = item as { type?: string; basename?: string; filename?: string };
        if (entry.type !== "directory" && entry.type !== "1") continue;
        const name = entry.basename ?? entry.filename?.split("/").pop() ?? "";
        if (!name || name.startsWith(".")) continue;
        const relPath = `${SENT_MAIL_ARCHIVE_BASE}/${name}`;
        try {
          const metaPath = getWebDAVPath(`${relPath}/metadata.json`);
          const raw = await webdavClient.getFileContents(metaPath, { format: "text" });
          const text = typeof raw === "string" ? raw : Buffer.from(raw as ArrayBuffer).toString("utf-8");
          const meta = JSON.parse(text) as { subject?: string; to?: string; sentAt?: string };
          results.push({
            folderName: name,
            path: relPath,
            subject: meta.subject ?? name,
            to: meta.to ?? "",
            sentAt: meta.sentAt ?? "",
          });
        } catch {
          results.push({ folderName: name, path: relPath, subject: name, to: "", sentAt: "" });
        }
      }
      results.sort((a, b) => (b.sentAt || "").localeCompare(a.sentAt || ""));
    } catch (err) {
      console.warn("[listSentMailFolders]", err);
    }
    return results;
  }

  try {
    const dirPath = path.join(path.resolve(env.FILE_ROOT_PATH), SENT_MAIL_ARCHIVE_BASE);
    const names = await fs.readdir(dirPath, { withFileTypes: true });
    for (const d of names) {
      if (!d.isDirectory()) continue;
      const relPath = `${SENT_MAIL_ARCHIVE_BASE}/${d.name}`;
      try {
        const metaPath = path.join(dirPath, d.name, "metadata.json");
        const text = await fs.readFile(metaPath, "utf-8");
        const meta = JSON.parse(text) as { subject?: string; to?: string; sentAt?: string };
        results.push({
          folderName: d.name,
          path: relPath,
          subject: meta.subject ?? d.name,
          to: meta.to ?? "",
          sentAt: meta.sentAt ?? "",
        });
      } catch {
        results.push({ folderName: d.name, path: relPath, subject: d.name, to: "", sentAt: "" });
      }
    }
    results.sort((a, b) => (b.sentAt || "").localeCompare(a.sentAt || ""));
  } catch {
    // folder may not exist yet
  }
  return results;
}

/**
 * List file names in a sent mail folder (e.g. Poslati_mailovi/Subject).
 */
export async function listSentMailFolderFiles(relativeFolderPath: string): Promise<string[]> {
  const normalized = relativeFolderPath.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/\/$/, "");
  if (!normalized.startsWith(SENT_MAIL_ARCHIVE_BASE + "/") || normalized.includes("..")) {
    return [];
  }
  if (USE_WEBDAV && webdavClient) {
    try {
      const fullPath = getWebDAVPath(normalized);
      const contents = await webdavClient.getDirectoryContents(fullPath);
      const items = Array.isArray(contents) ? contents : (contents as { data?: unknown[] }).data ?? [];
      return items
        .map((item: unknown) => {
          const e = item as { basename?: string; filename?: string };
          return e.basename ?? e.filename?.split("/").pop();
        })
        .filter((n): n is string => !!n && !n.startsWith("."));
    } catch {
      return [];
    }
  }
  try {
    const dirPath = path.join(path.resolve(env.FILE_ROOT_PATH), normalized);
    return await fs.readdir(dirPath);
  } catch {
    return [];
  }
}

/**
 * Read a file from sent mail archive. Path must be under Poslati_mailovi/ and must not contain ..
 */
export async function readSentMailFile(relativePath: string): Promise<Buffer | null> {
  const normalized = relativePath.replace(/\\/g, "/").replace(/\/+/g, "/");
  if (!normalized.startsWith(SENT_MAIL_ARCHIVE_BASE + "/") || normalized.includes("..")) {
    return null;
  }
  if (USE_WEBDAV && webdavClient) {
    try {
      const fullPath = getWebDAVPath(normalized);
      const data = await webdavClient.getFileContents(fullPath, { format: "binary" });
      return Buffer.from(data as ArrayBuffer);
    } catch {
      return null;
    }
  }
  try {
    const fullPath = path.join(path.resolve(env.FILE_ROOT_PATH), normalized);
    return await fs.readFile(fullPath);
  } catch {
    return null;
  }
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
  if (!(await claimHasProperFolderMetadata(claim))) {
    console.warn(`[createClaimFolder] Skipped: insufficient metadata for claim ${claim.id}`);
    return null;
  }
  const baseKey = await getClaimBaseKey(claim);
  if (isPlaceholderFolderKey(claim, baseKey)) {
    console.warn(`[createClaimFolder] Skipped: would create placeholder folder for claim ${claim.id}`);
    return null;
  }
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

/**
 * When folder name would change (domestic↔international, company/customer name, or MR code),
 * rename the existing folder on NAS to the new name so we never have duplicates and always
 * one source of truth. Returns new base key or null if no change or rename failed.
 */
export async function renameClaimFolderIfNeeded(
  claim: Claim & { customer?: { name: string | null; company?: string | null } | null; isDomesticMarket?: boolean; serverFolderPath?: string | null }
): Promise<string | null> {
  const oldStored = claim.serverFolderPath?.trim();
  if (!oldStored) return null;
  const newBaseKey = await getClaimBaseKey(claim);
  if (isPlaceholderFolderKey(claim, newBaseKey)) {
    console.warn(`[renameClaimFolder] Skip: target would be placeholder for claim ${claim.id}`);
    return null;
  }
  const oldBaseKey = path.isAbsolute(oldStored) || oldStored.includes(path.sep)
    ? path.basename(oldStored)
    : oldStored;
  if (oldBaseKey === newBaseKey) return null;

  if (USE_WEBDAV && webdavClient) {
    try {
      const fromPath = getWebDAVPath(oldBaseKey);
      const toPath = getWebDAVPath(newBaseKey);
      await webdavClient.moveFile(fromPath, toPath, { overwrite: false });
      console.log(`[renameClaimFolder] Renamed on Synology: ${oldBaseKey} -> ${newBaseKey}`);
      return newBaseKey;
    } catch (error) {
      console.error(`[renameClaimFolder] WebDAV rename failed:`, error);
      return null;
    }
  }
  try {
    const rootPath = path.resolve(env.FILE_ROOT_PATH);
    const oldPath = path.join(rootPath, oldBaseKey);
    const newPath = path.join(rootPath, newBaseKey);
    await fs.rename(oldPath, newPath);
    console.log(`[renameClaimFolder] Renamed on filesystem: ${oldBaseKey} -> ${newBaseKey}`);
    return newBaseKey;
  } catch (error) {
    console.error(`[renameClaimFolder] Filesystem rename failed:`, error);
    return null;
  }
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
    claim = await prismaClient.claim.findUnique({
      where: { id: params.claimId },
      include: { customer: true },
    });
    if (!claim) throw new Error(`Claim not found: ${params.claimId}`);
  } else {
    throw new Error("Either claim or claimId must be provided");
  }

  const sanitizedFileName = params.originalFileName
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_");
  const subfolder = params.subfolder || "03_attachments";

  if (USE_WEBDAV && webdavClient) {
    const baseKey = await resolveStorageBaseKey(claim);
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

    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await webdavClient.putFileContents(finalPath, params.fileBuffer, {
          overwrite: false,
          contentLength: params.fileBuffer.length,
        });
        const exists = await webdavClient.exists(finalPath);
        if (!exists) {
          throw new Error(`WebDAV verify failed: file missing after write (attempt ${attempt}/${maxAttempts})`);
        }
        const finalRelativePath = finalPath.replace(env.WEBDAV_BASE_PATH, '').replace(/^\//, '');
        return `webdav:${finalRelativePath}`;
      } catch (err) {
        console.error(`[saveAttachmentForClaim] WebDAV putFileContents attempt ${attempt}/${maxAttempts} failed:`, err);
        if (attempt === maxAttempts) throw err;
      }
    }
    throw new Error("Failed to save attachment to NAS after retries");
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

    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await webdavClient.putFileContents(finalPath, params.fileBuffer, {
          overwrite: false,
          contentLength: params.fileBuffer.length,
        });
        const exists = await webdavClient.exists(finalPath);
        if (!exists) {
          throw new Error(`WebDAV verify failed: file missing after write (attempt ${attempt}/${maxAttempts})`);
        }
        const finalRelativePath = finalPath.replace(env.WEBDAV_BASE_PATH, '').replace(/^\//, '');
        return `webdav:${finalRelativePath}`;
      } catch (err) {
        console.error(`[saveAttachmentForUnassignedThread] WebDAV putFileContents attempt ${attempt}/${maxAttempts} failed:`, err);
        if (attempt === maxAttempts) throw err;
      }
    }
    throw new Error("Failed to save attachment to NAS after retries");
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

/**
 * If attachment is stored under _unassigned (thread folder), copy it to the claim folder
 * and return the new filePath. Caller should update attachment.filePath in DB.
 * Returns null if path is not webdav:_unassigned/ or if read/save fails.
 */
export async function moveAttachmentFromUnassignedToClaim(
  attachment: { filePath: string; fileName: string; mimeType: string },
  claim: Claim & { customer?: { name: string | null; company?: string | null } | null }
): Promise<string | null> {
  if (!attachment.filePath.startsWith("webdav:_unassigned/")) {
    return null;
  }
  try {
    const buffer = await readAttachmentFile(attachment.filePath);
    const newPath = await saveAttachmentForClaim({
      claim,
      fileBuffer: buffer,
      originalFileName: attachment.fileName,
      mimeType: attachment.mimeType,
      subfolder: "03_attachments",
    });
    try {
      await deleteAttachmentFile(attachment.filePath);
    } catch (e) {
      console.warn("[moveAttachmentFromUnassignedToClaim] Could not delete old unassigned file:", e);
    }
    return newPath;
  } catch (err) {
    console.error("[moveAttachmentFromUnassignedToClaim]", err);
    return null;
  }
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

/**
 * Delete the temporary unassigned folder for a thread once it has been linked to a claim.
 * Call after moving all attachments to the claim folder to free space.
 */
export async function deleteUnassignedThreadFolder(threadId: string): Promise<void> {
  const baseKey = getUnassignedThreadKey(threadId);

  if (USE_WEBDAV && webdavClient) {
    try {
      const webdavPath = getWebDAVPath(baseKey);
      const exists = await webdavClient.exists(webdavPath);
      if (exists) {
        await webdavClient.deleteFile(webdavPath);
        console.log(`[deleteUnassignedThreadFolder] Deleted WebDAV folder: ${baseKey}`);
      }
    } catch (error) {
      console.warn("[deleteUnassignedThreadFolder] Could not delete folder:", error);
    }
    return;
  }

  try {
    const dirPath = path.join(path.resolve(env.FILE_ROOT_PATH), "_unassigned", threadId);
    await fs.rm(dirPath, { recursive: true, force: true });
    console.log(`[deleteUnassignedThreadFolder] Deleted local folder: ${dirPath}`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.warn("[deleteUnassignedThreadFolder] Could not delete folder:", error);
    }
  }
}

export async function deleteClaimFolder(claim: Claim & { customer?: { name: string | null } | null }): Promise<void> {
  const baseKey = await resolveStorageBaseKey(claim);

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
