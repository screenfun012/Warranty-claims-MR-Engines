/**
 * Export Planner - utility functions
 */

import { getPrisma } from "@/lib/db/prisma";
import { triggerEvent, CHANNELS, EVENTS } from "@/lib/realtime/pusher";

export async function createBatchAudit(
  batchId: string,
  action: string,
  opts?: { userId?: string | null; userEmail?: string; entityId?: string; details?: string }
): Promise<void> {
  try {
    const prisma = await getPrisma();
    const db = prisma as any;
    await db.exportBatchAudit.create({
      data: {
        batchId,
        action,
        userId: opts?.userId ?? undefined,
        userEmail: opts?.userEmail ?? undefined,
        entityId: opts?.entityId ?? undefined,
        details: opts?.details ?? undefined,
      },
    });
  } catch (err) {
    console.warn("[createBatchAudit] Failed:", err);
  }
}

export async function triggerBatchChanged(batchId: string): Promise<void> {
  await triggerEvent(CHANNELS.EXPORT_PLANNER, EVENTS.EXPORT_BATCH_CHANGED, { batchId });
}

export function nextBatchCode(batchType: string): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = batchType === "MR_ENGINES" ? "EXO" : "GNR";
  const rand = Math.floor(Math.random() * 100).toString().padStart(2, "0");
  return `EXP-${date}-${rand}${suffix}`;
}
