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
  const hydrated = await Promise.all(
    messages.map(async (m) => {
      if (!needsHydrate(m)) {
        return m;
      }
      try {
        const buf = await readAttachmentFile(m.rawSourcePath!);
        const { text, html } = await parseEmlBuffer(buf);
        return {
          ...m,
          bodyText: text ?? null,
          bodyHtml: html ?? null,
        } as T;
      } catch (e) {
        console.error(`[hydrateEmailMessages] Failed message ${m.id}:`, e);
        return m;
      }
    })
  );
  return hydrated;
}
