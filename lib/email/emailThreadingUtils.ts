/**
 * Email Threading Utilities
 * Rešava probleme sa grupisanjem email konverzacija:
 * 1. Pravilno grupiše RE: odgovore u isti thread
 * 2. Deduplikuje poruke koristeći Message-ID
 * 3. Uklanja quoted text iz RE: odgovora
 * 4. Hendluje CC emailove
 */

export interface EmailHeaders {
  subject: string;
  from: string;
  to: string;
  cc?: string;
  date: Date;
  messageId?: string;
  inReplyTo?: string;
  references?: string[];
}

/**
 * Čisti subject od RE:, FW:, Fwd: prefiksa i dodatnih razmaka
 * Ovo omogućava grupisanje svih odgovora u isti thread
 */
export function cleanSubject(subject: string): string {
  if (!subject) return "";
  
  // Ukloni sve RE:, FW:, FWD: prefikse (case-insensitive, sa i bez razmaka)
  let cleaned = subject;
  
  // Ponavljaj dok god postoje prefiksi (za slučaj RE: RE: RE:)
  let previousLength;
  do {
    previousLength = cleaned.length;
    cleaned = cleaned
      .replace(/^(RE|FW|FWD|Re|Fw|Fwd):\s*/i, '')
      .replace(/^\[([^\]]+)\]\s*/g, '') // Ukloni [tags]
      .trim();
  } while (cleaned.length < previousLength);
  
  return cleaned;
}

/**
 * Generiše thread ID koji grupiše sve povezane emailove
 * Prioritet:
 * 1. Prvi Message-ID iz References (root poruke)
 * 2. InReplyTo (za direktne odgovore)
 * 3. Normalizovan subject (fallback)
 */
export function generateThreadId(headers: EmailHeaders): string {
  // 1. Ako postoje references, koristi prvi (to je root poruka)
  if (headers.references && headers.references.length > 0) {
    return headers.references[0];
  }
  
  // 2. Ako je odgovor na nešto, koristi inReplyTo
  if (headers.inReplyTo) {
    return headers.inReplyTo;
  }
  
  // 3. Fallback na normalizovan subject
  const cleanedSubject = cleanSubject(headers.subject);
  return normalizeSubjectForThreading(cleanedSubject);
}

/**
 * Normalizuje subject za threading - uklanja ekstra razmake, lowercase, itd
 */
function normalizeSubjectForThreading(subject: string): string {
  return subject
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[^a-z0-9\s]/g, ''); // Ukloni interpunkciju
}

/**
 * Proverava da li je email deo istog thread-a
 * Poredi Message-ID, InReplyTo, References i Subject
 */
export function belongsToSameThread(
  message1: EmailHeaders,
  message2: EmailHeaders
): boolean {
  // 1. Proveri Message-ID matching
  if (message1.messageId && message2.messageId) {
    if (message1.messageId === message2.messageId) return true;
    
    // Proveri da li je message1 odgovor na message2
    if (message1.inReplyTo === message2.messageId) return true;
    if (message2.inReplyTo === message1.messageId) return true;
    
    // Proveri references
    if (message1.references?.includes(message2.messageId!)) return true;
    if (message2.references?.includes(message1.messageId!)) return true;
  }
  
  // 2. Fallback na subject matching
  const subject1 = cleanSubject(message1.subject);
  const subject2 = cleanSubject(message2.subject);
  
  return normalizeSubjectForThreading(subject1) === normalizeSubjectForThreading(subject2);
}

/**
 * Ekstraktuje čist sadržaj emaila bez quoted/citiranog teksta
 * Uklanja:
 * - "On DATE, NAME wrote:" blokove
 * - "> quoted lines"
 * - Email headers (From:, To:, Subject:, Date:)
 * - HTML signature blokove
 */
export function extractCleanBody(bodyText: string, bodyHtml?: string): string {
  // Preferiramo text verziju ako postoji
  let content = bodyText || bodyHtml || '';
  
  if (!content) return '';
  
  // 1. Ukloni HTML ako je potrebno
  if (!bodyText && bodyHtml) {
    content = stripHtmlTags(content);
  }
  
  // 2. Ukloni Gmail-style quoted sections: "On DATE, NAME wrote:"
  content = content.replace(/On\s+.*?wrote:[\s\S]*$/im, '');
  
  // 3. Ukloni Outlook-style quoted sections: "From: ... Sent: ..."
  content = content.replace(/_{3,}[\s\S]*?From:[\s\S]*$/im, '');
  content = content.replace(/-----Original Message-----[\s\S]*$/im, '');
  
  // 4. Ukloni sve linije koje počinju sa ">" (quoted text)
  content = content.replace(/^>+.*$/gm, '');
  
  // 5. Ukloni email header blokove
  const headerPatterns = [
    /^From:\s*.+$/gmi,
    /^To:\s*.+$/gmi,
    /^Cc:\s*.+$/gmi,
    /^Subject:\s*.+$/gmi,
    /^Date:\s*.+$/gmi,
    /^Sent:\s*.+$/gmi,
  ];
  
  headerPatterns.forEach(pattern => {
    content = content.replace(pattern, '');
  });
  
  // 6. Ukloni HTML signature markers
  content = content.replace(/--\s*$/gm, '');
  content = content.replace(/<div class="gmail_signature"[\s\S]*?<\/div>/gi, '');
  
  // 7. Ukloni višestruke prazne linije
  content = content.replace(/\n{3,}/g, '\n\n');
  
  // 8. Trim
  content = content.trim();
  
  return content;
}

/**
 * Uklanja HTML tagove i vraća clean text
 */
function stripHtmlTags(html: string): string {
  return html
    .replace(/<style[^>]*>.*?<\/style>/gis, '')
    .replace(/<script[^>]*>.*?<\/script>/gis, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/**
 * Proverava da li je email poslat na reklamacioni email (direktno ili CC)
 */
export function isClaimEmail(
  to: string,
  cc: string | undefined | null,
  claimEmailAddress: string
): boolean {
  const normalized = claimEmailAddress.toLowerCase().trim();
  
  // Proveri TO polje
  if (to && to.toLowerCase().includes(normalized)) {
    return true;
  }
  
  // Proveri CC polje
  if (cc && cc.toLowerCase().includes(normalized)) {
    return true;
  }
  
  return false;
}

/**
 * Proverava da li je email poslat DIREKTNO na reklamacioni email (ne CC)
 */
export function isSentDirectlyToClaim(
  to: string,
  claimEmailAddress: string
): boolean {
  const normalized = claimEmailAddress.toLowerCase().trim();
  return to && to.toLowerCase().includes(normalized);
}

/**
 * Ekstraktuje email adresu iz "Name <email@example.com>" formata
 */
export function extractEmailAddress(emailString: string): string {
  if (!emailString) return '';
  
  // Pokušaj sa <email@domain.com> formatom
  const match = emailString.match(/<([^>]+)>/);
  if (match) {
    return match[1].trim().toLowerCase();
  }
  
  // Pokušaj sa direktnim emailom
  const directMatch = emailString.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (directMatch) {
    return directMatch[1].trim().toLowerCase();
  }
  
  return emailString.trim().toLowerCase();
}

/**
 * Sortira poruke hronološki (najstarija prva)
 */
export function sortMessagesByDate<T extends { date: Date | string }>(
  messages: T[]
): T[] {
  return [...messages].sort((a, b) => {
    const dateA = typeof a.date === 'string' ? new Date(a.date) : a.date;
    const dateB = typeof b.date === 'string' ? new Date(b.date) : b.date;
    return dateA.getTime() - dateB.getTime();
  });
}

/**
 * Grupiše poruke u thread-ove na osnovu Message-ID i Subject
 */
export function groupMessagesIntoThreads<T extends EmailHeaders>(
  messages: T[]
): Map<string, T[]> {
  const threads = new Map<string, T[]>();
  
  messages.forEach(message => {
    const threadId = generateThreadId(message);
    
    if (!threads.has(threadId)) {
      threads.set(threadId, []);
    }
    
    threads.get(threadId)!.push(message);
  });
  
  // Sortiraj poruke u svakom thread-u
  threads.forEach((messages, threadId) => {
    threads.set(threadId, sortMessagesByDate(messages));
  });
  
  return threads;
}

/**
 * Deduplikuje poruke na osnovu Message-ID
 * Uklanja potpune duplikate
 */
export function deduplicateMessages<T extends { messageId?: string; id: string }>(
  messages: T[]
): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];
  
  messages.forEach(message => {
    // Koristi messageId ako postoji, inače id
    const key = message.messageId || message.id;
    
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(message);
    }
  });
  
  return unique;
}

/**
 * Format datuma za timeline prikaz
 */
export function formatEmailDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  return d.toLocaleDateString('sr-RS', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Proverava da li je poruka forward
 */
export function isForwardedEmail(subject: string, body: string): boolean {
  const subjectLower = subject.toLowerCase();
  const bodyLower = body.toLowerCase();
  
  return (
    subjectLower.startsWith('fwd:') ||
    subjectLower.startsWith('fw:') ||
    bodyLower.includes('forwarded message') ||
    bodyLower.includes('original message')
  );
}

/**
 * Pokušava da ekstraktuje originalnog pošiljaoca iz forward-ovanog emaila
 */
export function extractOriginalSenderFromForward(body: string): string | null {
  // Traži "From: email@domain.com" ili "From: Name <email@domain.com>"
  const patterns = [
    /From:\s*([^\r\n<]+<[^>]+>)/i,
    /From:\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i,
    /Original From:\s*([^\r\n<]+<[^>]+>)/i,
  ];
  
  for (const pattern of patterns) {
    const match = body.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }
  
  return null;
}
