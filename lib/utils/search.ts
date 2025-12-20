/**
 * Utility functions for search with Serbian Latin support
 */

/**
 * Normalizes Serbian Latin characters to their ASCII equivalents for search
 * š -> s, đ -> d, č -> c, ć -> c, ž -> z
 * Also handles uppercase variants
 */
export function normalizeSerbianLatin(text: string): string {
  if (!text) return "";
  
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0161\u0160]/g, "s") // š -> s
    .replace(/[\u0111\u0110]/g, "d") // đ -> d
    .replace(/[\u010d\u010c]/g, "c") // č -> c
    .replace(/[\u0107\u0106]/g, "c") // ć -> c
    .replace(/[\u017e\u017d]/g, "z") // ž -> z
    .replace(/[\u0300-\u036f]/g, ""); // Remove diacritics
}

/**
 * Creates a search-friendly version of text by normalizing Serbian characters
 * This allows searching for "s" to match "š", "d" to match "đ", etc.
 */
export function createSearchPattern(searchText: string): string {
  return normalizeSerbianLatin(searchText);
}

/**
 * Checks if a text matches a search query (case-insensitive, Serbian-aware)
 */
export function matchesSearch(text: string, searchQuery: string): boolean {
  if (!searchQuery) return true;
  if (!text) return false;
  
  const normalizedText = normalizeSerbianLatin(text);
  const normalizedQuery = normalizeSerbianLatin(searchQuery);
  
  return normalizedText.includes(normalizedQuery);
}

