/**
 * Helpers for Reply / Reply all / Forward recipient lists and quoting.
 */

export function extractEmailAddress(raw: string): string {
  const s = (raw || "").trim();
  if (!s) return "";
  const angle = s.match(/<([^>]+@[^>]+)>/);
  if (angle) return angle[1].trim().toLowerCase();
  const parts = s.split(/\s+/).filter((p) => p.includes("@"));
  return (parts[0] || s).replace(/[,;]/g, "").trim().toLowerCase();
}

export function splitAddressList(s: string | null | undefined): string[] {
  if (!s?.trim()) return [];
  return s
    .split(/[,;]/)
    .map((x) => extractEmailAddress(x))
    .filter(Boolean);
}

function normalizeEmail(e: string): string {
  return extractEmailAddress(e);
}

export function isOurEmail(addr: string, ourEmails: string[]): boolean {
  const n = normalizeEmail(addr);
  if (!n) return false;
  return ourEmails.some((o) => normalizeEmail(o) === n);
}

/** Build Reply: single recipient (from last inbound message). */
export function buildReplyTo(fromField: string): string {
  return extractEmailAddress(fromField) || fromField.trim();
}

/**
 * Reply all: To = From + original To (minus self); Cc = original Cc (minus To overlap & self).
 */
export function buildReplyAllRecipients(
  fromField: string,
  toField: string | null | undefined,
  ccField: string | null | undefined,
  ourEmails: string[]
): { to: string; cc: string } {
  const sender = extractEmailAddress(fromField);
  const toList = splitAddressList(toField).filter((e) => !isOurEmail(e, ourEmails));
  const ccList = splitAddressList(ccField).filter((e) => !isOurEmail(e, ourEmails));

  const toSet = new Set<string>();
  if (sender) toSet.add(sender);
  for (const e of toList) {
    toSet.add(e);
  }

  const ccOut: string[] = [];
  for (const e of ccList) {
    if (!toSet.has(e)) ccOut.push(e);
  }

  return {
    to: [...toSet].join(", "),
    cc: ccOut.join(", "),
  };
}

export function formatMessageIdHeader(id: string | null | undefined): string | undefined {
  if (!id?.trim()) return undefined;
  const s = id.trim();
  if (s.startsWith("<")) return s;
  return `<${s.replace(/^<|>$/g, "")}>`;
}

export function ensureReplySubject(subject: string, mode: "re" | "fw"): string {
  const s = (subject || "").trim();
  const re = /^re:\s*/i;
  const fw = /^fw:\s*/i;
  if (mode === "re") {
    if (re.test(s)) return s;
    return `Re: ${s || "(no subject)"}`;
  }
  if (fw.test(s)) return s;
  return `Fw: ${s || "(no subject)"}`;
}

export function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function buildQuotedReply(
  originalFrom: string,
  originalDate: Date,
  bodyText: string | null | undefined,
  bodyHtml: string | null | undefined
): { text: string; html: string } {
  const when = originalDate.toLocaleString();
  const header = `On ${when}, ${originalFrom} wrote:`;
  const plain = (bodyText || htmlToPlainText(bodyHtml || "")).trim();
  const text = `\n\n${header}\n> ${plain.replace(/\n/g, "\n> ")}\n`;

  const inner = bodyHtml?.trim()
    ? `<blockquote style="border-left:3px solid #ccc;margin:0 0 0 .5ex;padding-left:1ex">${bodyHtml}</blockquote>`
    : `<pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(plain)}</pre>`;
  const html = `<p><br></p><p>${escapeHtml(header)}</p>${inner}`;
  return { text, html };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
