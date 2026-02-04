#!/usr/bin/env node
/**
 * Run Export Planner migration on Turso
 * Usage: DATABASE_URL="libsql://..." TURSO_AUTH_TOKEN="..." node scripts/run-export-planner-migration-turso.mjs
 * Or with .env: node --env-file=.env.local scripts/run-export-planner-migration-turso.mjs
 */
import { createClient } from "@libsql/client";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { config } from "dotenv";

config({ path: ".env" });
config({ path: ".env.local" });

const url = process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN || process.env.DATABASE_AUTH_TOKEN;

if (!url || !url.startsWith("libsql://")) {
  console.error("DATABASE_URL (libsql://...) is required");
  process.exit(1);
}
if (!authToken) {
  console.error("TURSO_AUTH_TOKEN or DATABASE_AUTH_TOKEN is required");
  process.exit(1);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(
  join(__dirname, "../prisma/migrations/20260204000000_add_export_planner/migration.sql"),
  "utf8"
);

const client = createClient({ url, authToken });

async function run() {
  const statements = sql
    .split(";")
    .map((s) => s.replace(/--[^\n]*/g, "").trim())
    .filter((s) => s.length > 0);

  for (const stmt of statements) {
    try {
      await client.execute(stmt + ";");
      console.log("OK:", stmt.substring(0, 60) + "...");
    } catch (e) {
      if (e.message?.includes("already exists")) {
        console.log("SKIP (exists):", stmt.substring(0, 50) + "...");
      } else {
        throw e;
      }
    }
  }
  console.log("Migration complete.");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
