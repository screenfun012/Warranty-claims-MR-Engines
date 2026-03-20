/**
 * SQLite helpers for inbox thread search (subject, sender, claim code).
 * Mirrors lib/utils/search normalizeSerbianLatin for š/đ/č/ć/ž + lower().
 */

import { Prisma } from "@prisma/client";
import { normalizeSerbianLatin } from "@/lib/utils/search";

/** Trusted column refs only, e.g. t.subjectOriginal */
export function sqliteNormExprSql(columnRef: string): string {
  return `lower(replace(replace(replace(replace(replace(
    replace(replace(replace(replace(replace(
      replace(replace(replace(replace(replace(
        ${columnRef},
        'š','s'), 'Š','s'), 'đ','d'), 'Đ','d'), 'č','c'),
      'Č','c'), 'ć','c'), 'Ć','c'), 'ž','z'), 'Ž','z'))`;
}

const MAX_Q_LEN = 200;

export function normalizeInboxSearchQuery(q: string): string {
  const t = q.trim().slice(0, MAX_Q_LEN);
  return normalizeSerbianLatin(t);
}

/** Parameterized search predicate (nq = normalized needle). */
export function inboxThreadSearchWhereSql(nq: string): Prisma.Sql {
  const s = sqliteNormExprSql("t.subjectOriginal");
  const from = sqliteNormExprSql("ifnull(t.originalSender, '')");
  const code = sqliteNormExprSql("ifnull(c.claimCodeRaw, '')");
  return Prisma.sql`(
    instr(${Prisma.raw(s)}, ${nq}) > 0
    OR instr(${Prisma.raw(from)}, ${nq}) > 0
    OR instr(${Prisma.raw(code)}, ${nq}) > 0
  )`;
}
