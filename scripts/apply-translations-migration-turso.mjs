#!/usr/bin/env node
/**
 * Apply only the translations/languages migration (20260312000000) to Turso.
 * Usage: TURSO_DATABASE_URL="libsql://..." TURSO_AUTH_TOKEN="..." node scripts/apply-translations-migration-turso.mjs
 */

import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !url.startsWith("libsql://")) {
  console.error("Set TURSO_DATABASE_URL (libsql://...) and TURSO_AUTH_TOKEN");
  process.exit(1);
}
if (!authToken) {
  console.error("Set TURSO_AUTH_TOKEN");
  process.exit(1);
}

const client = createClient({ url, authToken });

const statements = [
  'ALTER TABLE "Attachment" ADD COLUMN "translationsJson" TEXT',
  'ALTER TABLE "ClientDocument" ADD COLUMN "translationsJson" TEXT',
  'ALTER TABLE "Claim" ADD COLUMN "summaryIt" TEXT',
  'ALTER TABLE "Claim" ADD COLUMN "summaryPl" TEXT',
  'ALTER TABLE "Claim" ADD COLUMN "summaryDa" TEXT',
  'ALTER TABLE "Claim" ADD COLUMN "summaryEs" TEXT',
  'ALTER TABLE "Claim" ADD COLUMN "summarySv" TEXT',
];

for (const sql of statements) {
  try {
    await client.execute(sql);
    console.log("OK:", sql.slice(0, 60) + "...");
  } catch (e) {
    if (e.message && e.message.includes("duplicate column name")) {
      console.log("SKIP (column exists):", sql.slice(0, 60) + "...");
    } else {
      console.error("FAIL:", sql);
      console.error(e.message || e);
      process.exit(1);
    }
  }
}

console.log("Done. Translations migration applied on Turso.");
