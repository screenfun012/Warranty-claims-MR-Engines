/**
 * Load email bodies from NAS .eml when DB fields were cleared after raw archive save.
 */

import { simpleParser } from "mailparser";
import { readAttachmentFile } from "@/lib/files/fileStorage";

export type MessageWithRawFields = {
  id: string;
  bodyText: string | null;
  bodyHtml: string | null;
  rawSourcePath: string | null;
};

export async function parseEmlBuffer(buffer: Buffer): Promise<{ text?: string; html?: string }> {
  const parsed = await simpleParser(buffer);
  const text = typeof parsed.text === "string" ? parsed.text : undefined;
  const html = typeof parsed.html === "string" ? parsed.html : undefined;
  return { text, html };
}

function needsHydrate(m: MessageWithRawFields): boolean {
  if (!m.rawSourcePath?.trim()) return false;
  const hasText = !!(m.bodyText && m.bodyText.trim());
  const hasHtml = !!(m.bodyHtml && m.bodyHtml.trim());
  return !hasText && !hasHtml;
}

/** Fill bodyText/bodyHtml from .eml on NAS when DB has no body but rawSourcePath exists */
export async function hydrateEmailMessages<T extends MessageWithRawFields>(messages: T[]): Promise<T[]> {
  const results: T[] = [];
  for (const m of messages) {
    if (!needsHydrate(m)) {
      results.push(m);
      continue;
    }
    try {
      const buf = await readAttachmentFile(m.rawSourcePath!);
      const { text, html } = await parseEmlBuffer(buf);
      results.push({
        ...m,
        bodyText: text ?? null,
        bodyHtml: html ?? null,
      } as T);
    } catch (e) {
      console.error(`[hydrateEmailMessages] Failed message ${m.id}:`, e);
      results.push(m);
    }
  }
  return results;
}
