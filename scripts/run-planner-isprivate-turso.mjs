#!/usr/bin/env node
/**
 * Dodaje isPrivate na ExportBatch i tabelu ExportPlannerColumnPreference na Turso.
 * Usage: TURSO_DATABASE_URL="libsql://..." TURSO_AUTH_TOKEN="..." node scripts/run-planner-isprivate-turso.mjs
 */
import { createClient } from "@libsql/client";
import { config } from "dotenv";

config({ path: ".env" });
config({ path: ".env.local" });

const url = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL;
let authToken = process.env.TURSO_AUTH_TOKEN || process.env.DATABASE_AUTH_TOKEN;
if (url?.includes("authToken=")) {
  const m = url.match(/[?&]authToken=([^&]+)/);
  if (m) authToken = m[1];
}

if (!url || !url.replace(/[?&]authToken=[^&]+/, "").trim().startsWith("libsql://")) {
  console.error("TURSO_DATABASE_URL (libsql://...) i TURSO_AUTH_TOKEN su potrebni");
  process.exit(1);
}
if (!authToken) {
  console.error("TURSO_AUTH_TOKEN je potreban");
  process.exit(1);
}

const cleanUrl = url.replace(/[?&]authToken=[^&]+/, "").replace(/\?$/, "");
const client = createClient({ url: cleanUrl, authToken });

const statements = [
  `ALTER TABLE "ExportBatch" ADD COLUMN "isPrivate" INTEGER NOT NULL DEFAULT 0`,
  `CREATE INDEX IF NOT EXISTS "ExportBatch_isPrivate_createdById_idx" ON "ExportBatch"("isPrivate", "createdById")`,
  `CREATE TABLE IF NOT EXISTS "ExportPlannerColumnPreference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "batchType" TEXT NOT NULL,
    "columnOrder" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExportPlannerColumnPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "ExportPlannerColumnPreference_userId_batchType_key" ON "ExportPlannerColumnPreference"("userId", "batchType")`,
  `CREATE INDEX IF NOT EXISTS "ExportPlannerColumnPreference_userId_idx" ON "ExportPlannerColumnPreference"("userId")`,
];

async function run() {
  for (const stmt of statements) {
    try {
      await client.execute(stmt);
      console.log("OK:", stmt.substring(0, 55) + "...");
    } catch (e) {
      const msg = (e.message || String(e)).toLowerCase();
      if (msg.includes("duplicate column") || msg.includes("already exists")) {
        console.log("SKIP (već postoji):", stmt.substring(0, 50) + "...");
      } else {
        console.error("Statement:", stmt);
        throw e;
      }
    }
  }
  console.log("Gotovo.");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
