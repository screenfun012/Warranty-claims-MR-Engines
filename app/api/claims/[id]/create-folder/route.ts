/**
 * POST /api/claims/[id]/create-folder
 * Creates the Synology/NAS folder for a claim (e.g. when it was missing due to async failure).
 * OPERATOR+ can call. Idempotent: if folder already exists, just updates serverFolderPath.
 */

import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db/prisma";
import { createClaimFolder } from "@/lib/files/fileStorage";
import { requirePermission, createPermissionError, PERMISSIONS } from "@/lib/auth/permissions";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const prisma = await getPrisma();
    await requirePermission(PERMISSIONS.CLAIMS_UPDATE);

    const { id: claimId } = await params;

    const claim = await prisma.claim.findUnique({
      where: { id: claimId },
      include: { customer: true },
    });

    if (!claim) {
      return NextResponse.json({ error: "Claim not found" }, { status: 404 });
    }

    const folderPath = await createClaimFolder(claim);

    if (!folderPath) {
      return NextResponse.json(
        { error: "Folder creation failed (check WebDAV/storage config or logs)" },
        { status: 500 }
      );
    }

    await prisma.claim.update({
      where: { id: claimId },
      data: { serverFolderPath: folderPath },
    });

    return NextResponse.json({ serverFolderPath: folderPath });
  } catch (error) {
    console.error("[create-folder] Error:", error);
    const permError = createPermissionError(error);
    if (permError.status !== 500) {
      return NextResponse.json({ error: permError.message }, { status: permError.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create folder" },
      { status: 500 }
    );
  }
}
