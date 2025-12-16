/**
 * PDF text extraction utility
 * Extracts plain text from PDF files for translation
 * Uses pdfjs-dist for better Next.js compatibility
 */

/**
 * Extract text from a PDF buffer
 * @param buffer - PDF file buffer
 * @returns Extracted plain text
 */
export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  try {
    // Use pdfjs-dist with legacy build for server-side compatibility
    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.min.mjs");
    
    // Load the PDF document
    const loadingTask = pdfjsLib.getDocument({ 
      data: new Uint8Array(buffer),
      useSystemFonts: true,
    });
    const pdf = await loadingTask.promise;
    
    let fullText = "";
    
    // Extract text from all pages
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(" ");
      fullText += pageText + "\n";
    }
    
    return fullText.trim();
  } catch (error) {
    console.error("Error extracting text from PDF:", error);
    throw new Error(`Failed to extract text from PDF: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

