/**
 * Utility functions for cleaning email body text
 * Removes HTML comments, CSS styles, email headers, and extracts clean text
 */

/**
 * Clean email body text by removing:
 * - HTML comments (<!-- ... -->)
 * - CSS styles (<style>...</style>)
 * - Email header information (From:, Date:, To:, Cc:, Subject:)
 * - Preserves text structure (line breaks, paragraphs)
 */
export function cleanEmailBodyText(text: string | null | undefined): string {
  if (!text) return "";

  let cleaned = text;

  // Remove HTML comments (including multi-line)
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, "");

  // Remove <style> tags and their content
  cleaned = cleaned.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");

  // Remove email header patterns (From:, Date:, To:, Cc:, Subject:)
  // Match patterns like "From: email@domain.com" or "From: Name <email@domain.com>"
  // Also handle patterns with email addresses in angle brackets
  const headerPatterns = [
    /^From:\s*[^\r\n]+(<[^>]+>)?[^\r\n]*/gmi,
    /^Date:\s*[^\r\n]+/gmi,
    /^To:\s*[^\r\n]+(<[^>]+>)?[^\r\n]*/gmi,
    /^Cc:\s*[^\r\n]+(<[^>]+>)?[^\r\n]*/gmi,
    /^Subject:\s*[^\r\n]+/gmi,
    /^Original\s+From[^\r\n]*/gmi,
    /^Sent:\s*[^\r\n]+/gmi,
    /^Original\s+To[^\r\n]*/gmi,
    // Handle forwarded email headers
    /^FW:\s*[^\r\n]+/gmi,
    /^Fwd:\s*[^\r\n]+/gmi,
  ];

  headerPatterns.forEach(pattern => {
    cleaned = cleaned.replace(pattern, "");
  });
  
  // Remove lines that look like email addresses (standalone)
  // This catches cases where header info might be on separate lines
  cleaned = cleaned.replace(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\s*$/gmi, "");

  // Remove multiple consecutive blank lines (more than 2)
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");

  // Trim whitespace from start and end
  cleaned = cleaned.trim();

  return cleaned;
}

/**
 * Extract clean text from HTML, removing all HTML tags but preserving structure
 */
export function extractTextFromHtml(html: string | null | undefined): string {
  if (!html) return "";

  let text = html;

  // First, clean HTML comments and styles
  text = cleanEmailBodyText(text);

  // Remove all HTML tags but preserve line breaks
  // Replace <br>, <br/>, <br /> with newlines
  text = text.replace(/<br\s*\/?>/gi, "\n");
  
  // Replace </p>, </div>, </li> with newlines
  text = text.replace(/<\/p>/gi, "\n");
  text = text.replace(/<\/div>/gi, "\n");
  text = text.replace(/<\/li>/gi, "\n");
  
  // Remove all remaining HTML tags
  text = text.replace(/<[^>]+>/g, "");

  // Decode HTML entities
  const entityMap: Record<string, string> = {
    "&quot;": '"',
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&nbsp;": " ",
    "&#39;": "'",
    "&#x27;": "'",
    "&#x2F;": "/",
    "&apos;": "'",
  };

  Object.entries(entityMap).forEach(([entity, char]) => {
    text = text.replace(new RegExp(entity, "gi"), char);
  });

  // Decode numeric entities
  text = text.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec));
  text = text.replace(/&#x([a-f\d]+);/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)));

  // Clean up email headers again (in case they were in HTML)
  text = cleanEmailBodyText(text);

  // Normalize whitespace but preserve line breaks
  // Replace multiple spaces with single space (but keep newlines)
  text = text.replace(/[ \t]+/g, " ");
  
  // Remove multiple consecutive blank lines (more than 2)
  text = text.replace(/\n{3,}/g, "\n\n");

  // Trim whitespace from start and end
  text = text.trim();

  return text;
}

/**
 * Get clean email body text from message (prefers bodyText, falls back to bodyHtml)
 */
export function getCleanEmailBody(message: {
  bodyText?: string | null;
  bodyHtml?: string | null;
}): string {
  // Try bodyText first
  if (message.bodyText && message.bodyText.trim()) {
    return cleanEmailBodyText(message.bodyText);
  }

  // If no bodyText, extract from bodyHtml
  if (message.bodyHtml && message.bodyHtml.trim()) {
    return extractTextFromHtml(message.bodyHtml);
  }

  return "";
}

