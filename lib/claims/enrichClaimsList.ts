import type { PrismaClient } from "@prisma/client";

/**
 * Lista reklamacija: eksplicitni JOIN preko raw SQL da budu uvek vidljivi
 * customerNumber, assignedWorkerName, datumi i radni nalog — ne oslanjamo se
 * samo na Prisma include (Turso/libsql edge slučajevi).
 */
const CHUNK = 250;

export async function enrichClaimsForListView(
  prisma: PrismaClient,
  claims: unknown[]
): Promise<unknown[]> {
  if (!claims.length) return claims;

  type Row = {
    id: string;
    customerNumber: string | null;
    customerReference: string | null;
    invoiceNumber: string | null;
    assignedWorkerName: string | null;
    dateEngineDone: Date | null;
    yearEngineDone: number | null;
    workOrderId: string | null;
    woAssemblyDate: Date | null;
    woWorkerFullName: string | null;
    assignedToFullName: string | null;
  };

  const allRows: Row[] = [];
  for (let i = 0; i < claims.length; i += CHUNK) {
    const chunk = claims.slice(i, i + CHUNK);
    const ids = chunk.map((c: any) => c.id as string);
    const placeholders = ids.map(() => "?").join(",");
    const rows = await prisma.$queryRawUnsafe<Row[]>(
      `SELECT
      c."id",
      c."customerNumber",
      c."customerReference",
      c."invoiceNumber",
      c."assignedWorkerName",
      c."dateEngineDone",
      c."yearEngineDone",
      c."workOrderId",
      w."assemblyDate" AS "woAssemblyDate",
      uw."fullName" AS "woWorkerFullName",
      ua."fullName" AS "assignedToFullName"
    FROM Claim c
    LEFT JOIN WorkOrder w ON w."id" = c."workOrderId"
    LEFT JOIN User uw ON uw."id" = w."workerId"
    LEFT JOIN User ua ON ua."id" = c."assignedToId"
    WHERE c."id" IN (${placeholders})`,
      ...ids
    );
    allRows.push(...rows);
  }

  const byId = new Map(allRows.map((r) => [r.id, r]));

  return claims.map((raw) => {
    const c = raw as Record<string, any>;
    const r = byId.get(c.id);
    if (!r) return raw;

    const assignedFullName = r.assignedToFullName ?? c.assignedTo?.fullName ?? null;
    const assignedTo =
      assignedFullName != null && String(assignedFullName).trim() !== ""
        ? {
            id: c.assignedTo?.id ?? "",
            fullName: assignedFullName,
            email: c.assignedTo?.email ?? null,
          }
        : c.assignedTo ?? null;

    const workOrder =
      r.workOrderId != null
        ? {
            id: r.workOrderId,
            assemblyDate: r.woAssemblyDate ?? c.workOrder?.assemblyDate ?? null,
            worker:
              r.woWorkerFullName != null && String(r.woWorkerFullName).trim() !== ""
                ? {
                    id: c.workOrder?.worker?.id ?? "",
                    fullName: r.woWorkerFullName,
                  }
                : c.workOrder?.worker ?? null,
          }
        : c.workOrder ?? null;

    return {
      ...c,
      customerNumber: r.customerNumber ?? c.customerNumber ?? null,
      customerReference: r.customerReference ?? c.customerReference ?? null,
      invoiceNumber: r.invoiceNumber ?? c.invoiceNumber ?? null,
      assignedWorkerName: r.assignedWorkerName ?? c.assignedWorkerName ?? null,
      dateEngineDone: r.dateEngineDone ?? c.dateEngineDone ?? null,
      yearEngineDone: r.yearEngineDone ?? c.yearEngineDone ?? null,
      assignedTo,
      workOrder,
    };
  });
}
