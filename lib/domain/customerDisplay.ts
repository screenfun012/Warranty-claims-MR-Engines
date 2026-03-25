/**
 * Jedan string za tabele / liste: domaće tržište — prvo ime kupca, strano — prvo firma.
 */
export function customerPrimaryLabel(claim: {
  isDomesticMarket?: boolean | null;
  customer?: { name?: string | null; company?: string | null } | null;
}): string {
  const c = claim.customer;
  if (!c) return "-";
  const name = (c.name ?? "").trim();
  const company = (c.company ?? "").trim();
  if (claim.isDomesticMarket) {
    return name || company || "-";
  }
  return company || name || "-";
}
