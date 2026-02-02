/**
 * POST /api/claims/create-missing-folders
 * Creates Synology/NAS folders for all claims that don't have serverFolderPath.
 * OPERATOR+ can call. Useful to fix claims created when folder creation failed.
 */

import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db/prisma";
import { createClaimFolder, moveAttachmentsFromUnassignedToClaim } from "@/lib/files/fileStorage";
import { requirePermission, createPermissionError, PERMISSIONS } from "@/lib/auth/permissions";

export async function POST() {
  try {
    const prisma = await getPrisma();
    await requirePermission(PERMISSIONS.CLAIMS_UPDATE);

    const claimsWithoutFolder = await prisma.claim.findMany({
      where: { serverFolderPath: null },
      include: { customer: true },
    });

    const results: { claimId: string; claimCode: string | null; ok: boolean; path?: string; error?: string; moved?: number }[] = [];

    for (const claim of claimsWithoutFolder) {
      try {
        const folderPath = await createClaimFolder(claim);
        if (folderPath) {
          await prisma.claim.update({
            where: { id: claim.id },
            data: { serverFolderPath: folderPath },
          });
          const moveResult = await moveAttachmentsFromUnassignedToClaim(claim);
          results.push({ claimId: claim.id, claimCode: claim.claimCodeRaw, ok: true, path: folderPath, moved: moveResult.moved });
        } else {
          results.push({ claimId: claim.id, claimCode: claim.claimCodeRaw, ok: false, error: "createClaimFolder returned null" });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        results.push({ claimId: claim.id, claimCode: claim.claimCodeRaw, ok: false, error: msg });
      }
    }

    const created = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok).length;

    return NextResponse.json({
      total: claimsWithoutFolder.length,
      created,
      failed,
      results,
    });
  } catch (error) {
    console.error("[create-missing-folders] Error:", error);
    const permError = createPermissionError(error);
    if (permError.status !== 500) {
      return NextResponse.json({ error: permError.message }, { status: permError.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create missing folders" },
      { status: 500 }
    );
  }
}
