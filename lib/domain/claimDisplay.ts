/**
 * Ko je radio motor: polje `assignedWorkerName` ili (legacy) ime iz `assignedTo` (User).
 * Ranije je lista koristila samo assignedTo; kasnije slobodan tekst — oba izvora treba u UI.
 */
export function workerWhoBuiltMotorLabel(claim: {
  assignedWorkerName?: string | null;
  assignedTo?: { fullName?: string | null } | null;
}): string {
  const text = (claim.assignedWorkerName ?? "").trim();
  if (text) return text;
  return (claim.assignedTo?.fullName ?? "").trim();
}

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
