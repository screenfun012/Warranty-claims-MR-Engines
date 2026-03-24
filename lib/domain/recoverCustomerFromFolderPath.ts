/**
 * Rekonstrukcija imena/firme kupca iz serverFolderPath kada je u bazi prazno,
 * a folder je kreiran po istom pravilu kao getClaimBaseKey (fileStorage.ts).
 */

import type { PrismaClient } from "@prisma/client";
import { sanitizeClaimCodeForPath } from "./claimCode";

export function extractLabelFromFolderPath(
  serverFolderPath: string,
  claimCodeRaw: string
): string | null {
  const trimmed = serverFolderPath.trim();
  if (!trimmed || !claimCodeRaw?.trim()) return null;

  const baseKey = /[/\\]/.test(trimmed)
    ? trimmed.replace(/[/\\]+$/, "").split(/[/\\]/).pop() ?? trimmed
    : trimmed;

  const sanitizedCode = sanitizeClaimCodeForPath(claimCodeRaw.trim());
  const suffix = ` - ${sanitizedCode}`;
  if (!baseKey.endsWith(suffix)) return null;

  const label = baseKey.slice(0, -suffix.length).trim();
  return label || null;
}

export function parseFolderLabelToCustomer(
  label: string,
  isDomesticMarket: boolean
): { name: string | null; company: string | null } {
  if (isDomesticMarket) {
    const m = label.match(/^(.+?)\s*\((.+)\)\s*$/);
    if (m) {
      return { name: m[1].trim(), company: m[2].trim() };
    }
    return { name: label.trim(), company: null };
  }
  return { name: null, company: label.trim() || null };
}

type ClaimRow = {
  id: string;
  customerId: string | null;
  claimCodeRaw: string | null;
  serverFolderPath: string | null;
  isDomesticMarket: boolean;
  customer: { id: string; name: string | null; company: string | null } | null;
};

export type RecoverOutcome =
  | { result: "skipped"; reason?: string }
  | { result: "updated" }
  | { result: "would_update"; preview: { name?: string; company?: string } };

export async function recoverCustomerForClaimFromPath(
  prisma: PrismaClient,
  claim: ClaimRow,
  options?: { dryRun?: boolean }
): Promise<RecoverOutcome> {
  const dryRun = options?.dryRun === true;

  if (!claim.serverFolderPath?.trim() || !claim.claimCodeRaw?.trim()) {
    return { result: "skipped", reason: "no path or claim code" };
  }

  const label = extractLabelFromFolderPath(claim.serverFolderPath, claim.claimCodeRaw);
  if (!label) {
    return { result: "skipped", reason: "folder name does not end with ' - ' + MR code" };
  }

  const parsed = parseFolderLabelToCustomer(label, claim.isDomesticMarket);

  if (claim.customer) {
    const data: { name?: string | null; company?: string | null } = {};
    if (!claim.customer.company?.trim() && parsed.company?.trim()) {
      data.company = parsed.company.trim();
    }
    if (!claim.customer.name?.trim() && parsed.name?.trim()) {
      data.name = parsed.name.trim();
    }
    if (Object.keys(data).length === 0) {
      return { result: "skipped", reason: "customer already has parsed fields" };
    }
    if (dryRun) {
      const preview: { name?: string; company?: string } = {};
      if (data.name !== undefined) preview.name = data.name ?? undefined;
      if (data.company !== undefined) preview.company = data.company ?? undefined;
      return { result: "would_update", preview };
    }
    await prisma.customer.update({
      where: { id: claim.customer.id },
      data,
    });
    return { result: "updated" };
  }

  if (dryRun) {
    const preview: { name?: string; company?: string } = {};
    if (parsed.name?.trim()) preview.name = parsed.name.trim();
    if (parsed.company?.trim()) preview.company = parsed.company.trim();
    return { result: "would_update", preview };
  }

  await prisma.customer.create({
    data: {
      name: parsed.name,
      company: parsed.company,
      claims: { connect: { id: claim.id } },
    },
  });
  return { result: "updated" };
}
