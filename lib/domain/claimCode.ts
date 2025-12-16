/**
 * Claim code parsing helper
 * Parses claim codes like "MR1234/25", "1234/25", "MR1234/2025"
 */

export type ParsedClaimCode = {
  raw: string;
  prefix: string;
  number: number | null;
  year: number | null;
};

/**
 * Parse a claim code string into its components
 * @param raw - Raw claim code string, e.g. "MR1234/25", "1234/25", "MR1234/2025"
 * @returns Parsed claim code with prefix, number, and year
 */
export function parseClaimCode(raw: string): ParsedClaimCode {
  const trimmed = raw.trim();
  
  if (!trimmed) {
    return { raw: trimmed, prefix: "", number: null, year: null };
  }

  // Extract prefix (initial letters)
  const prefixMatch = trimmed.match(/^([A-Za-z]+)/);
  const prefix = prefixMatch ? prefixMatch[1].toUpperCase() : "";

  // Remove prefix to get numeric part
  const numericPart = trimmed.slice(prefix.length);

  // Split by / to separate number and year
  const parts = numericPart.split("/");
  
  let number: number | null = null;
  let year: number | null = null;

  if (parts.length >= 1 && parts[0]) {
    // Extract number from left part (may have letters mixed, take only digits)
    const numberMatch = parts[0].match(/\d+/);
    if (numberMatch) {
      number = parseInt(numberMatch[0], 10);
    }
  }

  if (parts.length >= 2 && parts[1]) {
    // Extract year from right part
    const yearStr = parts[1].trim();
    const yearNum = parseInt(yearStr, 10);
    
    if (!isNaN(yearNum)) {
      // Normalize year: if 2 digits and < 50 → 2000 + suffix, else use as is
      if (yearStr.length === 2 && yearNum < 50) {
        year = 2000 + yearNum;
      } else if (yearStr.length === 4) {
        year = yearNum;
      } else {
        // Assume 2-digit years >= 50 are 1900s (unlikely for warranty claims, but handle it)
        year = yearNum < 50 ? 2000 + yearNum : 1900 + yearNum;
      }
    }
  }

  return {
    raw: trimmed,
    prefix,
    number,
    year,
  };
}

/**
 * Sanitize claim code for use in file paths
 * Replaces / with -, removes unsafe characters
 */
export function sanitizeClaimCodeForPath(claimCode: string): string {
  return claimCode
    .replace(/\//g, "-")
    .replace(/[^a-zA-Z0-9\-_]/g, "_")
    .replace(/_{2,}/g, "_");
}

