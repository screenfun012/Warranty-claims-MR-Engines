/**
 * DOCX text extraction utility
 * Extracts plain text from Word documents for translation
 */

/**
 * Extract text from a DOCX buffer
 * @param buffer - DOCX file buffer
 * @returns Extracted plain text
 */
export async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  try {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value || "";
  } catch (error) {
    console.error("Error extracting text from DOCX:", error);
    throw new Error(`Failed to extract text from DOCX: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

