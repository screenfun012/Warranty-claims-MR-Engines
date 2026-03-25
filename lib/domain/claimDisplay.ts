/** Datum u listama (lokalni kalendar, ne UTC komponente). */
export function formatClaimTableDate(iso: string | null | undefined): string {
  if (!iso) return "–";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "–";
  return d.toLocaleDateString("sr-Latn", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });
}

/**
 * Ko je radio motor: tekst na claim-u, zatim User assignedTo, zatim radnik sa radnog naloga (legacy).
 */
export function workerWhoBuiltMotorLabel(claim: {
  assignedWorkerName?: string | null;
  assignedTo?: { fullName?: string | null } | null;
  workOrder?: { worker?: { fullName?: string | null } | null } | null;
}): string {
  const text = (claim.assignedWorkerName ?? "").trim();
  if (text) return text;
  const assigned = (claim.assignedTo?.fullName ?? "").trim();
  if (assigned) return assigned;
  return (claim.workOrder?.worker?.fullName ?? "").trim();
}

/** Customer number na claim-u ili legacy reference/invoice ako je tako uneto. */
export function customerNumberForList(claim: {
  customerNumber?: string | null;
  customerReference?: string | null;
  invoiceNumber?: string | null;
}): string {
  return (
    (claim.customerNumber ?? "").trim() ||
    (claim.customerReference ?? "").trim() ||
    (claim.invoiceNumber ?? "").trim()
  );
}

/**
 * Datum izrade / sklapanja motora: Claim.dateEngineDone ili WorkOrder.assemblyDate (legacy).
 * Ako ima samo godinu (yearEngineDone), prikaži je kao broj.
 */
export function engineAssemblyDateForList(claim: {
  dateEngineDone?: string | Date | null;
  yearEngineDone?: number | null;
  workOrder?: { assemblyDate?: string | Date | null } | null;
}): string {
  const raw = claim.dateEngineDone ?? claim.workOrder?.assemblyDate;
  if (raw != null && raw !== "") {
    const iso = typeof raw === "string" ? raw : raw.toISOString();
    return formatClaimTableDate(iso);
  }
  if (claim.yearEngineDone != null && !Number.isNaN(Number(claim.yearEngineDone))) {
    return String(claim.yearEngineDone);
  }
  return "–";
}
