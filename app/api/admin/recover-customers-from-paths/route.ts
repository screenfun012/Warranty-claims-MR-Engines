/**
 * SUPER_ADMIN: jednokratno popunjava Customer.name / Customer.company iz serverFolderPath
 * kada su prazni, koristeći isti format foldera kao getClaimBaseKey (fileStorage).
 *
 * POST { "dryRun": true } — samo pregled šta bi se promenilo (ne piše u bazu).
 */

import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db/prisma";
import { createPermissionError, requireMinimumRole } from "@/lib/auth/permissions";
import { ROLES } from "@/lib/auth/roles";
import { recoverCustomerForClaimFromPath } from "@/lib/domain/recoverCustomerFromFolderPath";
import { logActivityFromRequest } from "@/lib/activity-log";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const prisma = await getPrisma();
    try {
      await requireMinimumRole(ROLES.SUPER_ADMIN);
    } catch (permErr) {
      const e = createPermissionError(permErr);
      return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    }

    let dryRun = false;
    try {
      const body = await request.json();
      dryRun = body?.dryRun === true;
    } catch {
      // prazan body
    }

    const claims = await prisma.claim.findMany({
      where: {
        AND: [
          { serverFolderPath: { not: null } },
          { NOT: { serverFolderPath: "" } },
          { claimCodeRaw: { not: null } },
          { NOT: { claimCodeRaw: "" } },
        ],
      },
      include: { customer: true },
    });

    let skipped = 0;
    const changes: Array<{
      claimId: string;
      claimCodeRaw: string | null;
      mode: "updated" | "would_update";
      preview?: { name?: string; company?: string };
    }> = [];

    for (const claim of claims) {
      const out = await recoverCustomerForClaimFromPath(prisma, claim, { dryRun });
      if (out.result === "skipped") {
        skipped++;
        continue;
      }
      if (out.result === "updated") {
        changes.push({ claimId: claim.id, claimCodeRaw: claim.claimCodeRaw, mode: "updated" });
        continue;
      }
      if (out.result === "would_update") {
        changes.push({
          claimId: claim.id,
          claimCodeRaw: claim.claimCodeRaw,
          mode: "would_update",
          preview: out.preview,
        });
      }
    }

    if (!dryRun && changes.length > 0) {
      logActivityFromRequest(request, {
        action: "UPDATE",
        entityType: "SYSTEM",
        entityId: "recover-customers-from-paths",
        entityName: "Recover customer from folder paths",
        details: { fixedClaims: changes.length },
      }).catch(() => {});
    }

    return NextResponse.json({
      ok: true,
      dryRun,
      totalClaimsWithPathAndCode: claims.length,
      fixedOrWouldFix: changes.length,
      skipped,
      changes: changes.slice(0, 200),
    });
  } catch (error) {
    console.error("[recover-customers-from-paths]", error);
    const e = createPermissionError(error);
    if (e.status !== 500) {
      return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    }
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}
