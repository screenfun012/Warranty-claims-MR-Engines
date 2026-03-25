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
