/**
 * Primena Prisma migracija na Turso kada `prisma migrate deploy` ne radi (libsql://).
 * Ako je `_prisma_migrations` prazan a tabele već postoje, SQL koji padne sa
 * "already exists" se preskače — tipično posle ručnog / starog setupa.
 *
 *   TURSO_DATABASE_URL="libsql://....turso.io" TURSO_AUTH_TOKEN="..." npx tsx scripts/turso-apply-pending-migrations.ts
 */
import { createClient } from "@libsql/client";
import { createHash, randomUUID } from "crypto";
import fs from "fs";
import path from "path";

const MIGRATIONS_TABLE = `
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id"                    TEXT PRIMARY KEY NOT NULL,
    "checksum"              TEXT NOT NULL,
    "finished_at"           DATETIME,
    "migration_name"        TEXT NOT NULL,
    "logs"                  TEXT,
    "rolled_back_at"        DATETIME,
    "started_at"            DATETIME NOT NULL DEFAULT current_timestamp,
    "applied_steps_count"   INTEGER UNSIGNED NOT NULL DEFAULT 0
);
`;

function getConnection() {
  let url = process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL ?? "";
  let authToken = process.env.TURSO_AUTH_TOKEN?.trim() ?? process.env.DATABASE_AUTH_TOKEN?.trim() ?? "";

  if (url.includes("authToken=")) {
    const m = url.match(/[?&]authToken=([^&]+)/);
    if (m) authToken = decodeURIComponent(m[1]);
    url = url.split("?")[0];
  }

  if (!url.startsWith("libsql://")) {
    console.error("Postavi TURSO_DATABASE_URL=libsql://... + TURSO_AUTH_TOKEN.");
    process.exit(1);
  }
  if (!authToken) {
    console.error("Nedostaje TURSO_AUTH_TOKEN.");
    process.exit(1);
  }

  return createClient({ url, authToken });
}

function splitSqlStatements(sql: string): string[] {
  const lines = sql.split("\n").filter((line) => !line.trim().startsWith("--"));
  const body = lines.join("\n").trim();
  if (!body) return [];
  return body
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

function isIgnorableError(e: unknown): boolean {
  const msg = String((e as { message?: string })?.message ?? e);
  return (
    msg.includes("already exists") ||
    msg.includes("duplicate column name") ||
    msg.includes("UNIQUE constraint failed") ||
    msg.includes("index .* already exists")
  );
}

async function main() {
  const client = getConnection();
  await client.execute(MIGRATIONS_TABLE.trim());

  const migrationsDir = path.join(process.cwd(), "prisma", "migrations");

  const dirs = fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("."))
    .map((d) => d.name)
    .sort();

  const appliedRows = await client.execute(
    'SELECT "migration_name" FROM "_prisma_migrations" WHERE "finished_at" IS NOT NULL'
  );
  const applied = new Set(
    (appliedRows.rows as { migration_name: string }[]).map((r) => r.migration_name)
  );

  let newCount = 0;

  for (const name of dirs) {
    if (applied.has(name)) {
      console.log("skip (već u _prisma_migrations):", name);
      continue;
    }
    const file = path.join(migrationsDir, name, "migration.sql");
    if (!fs.existsSync(file)) continue;

    const raw = fs.readFileSync(file, "utf8");
    const checksum = createHash("sha256").update(raw).digest("hex");
    const stmts = splitSqlStatements(raw);
    console.log("process:", name, `(${stmts.length} stmt)`);

    const started = new Date().toISOString();
    let ran = 0;
    for (const stmt of stmts) {
      try {
        await client.execute(stmt);
        ran++;
      } catch (e) {
        if (isIgnorableError(e)) {
          console.log("  skip:", (e as Error).message?.slice(0, 120) ?? e);
          continue;
        }
        throw e;
      }
    }

    const id = randomUUID();
    await client.execute({
      sql: `INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
            VALUES (?, ?, datetime('now'), ?, NULL, NULL, ?, ?)`,
      args: [id, checksum, name, started, stmts.length],
    });
    newCount++;
    console.log("  recorded migration row;", ran, "stmt izvršeno (ostalo preskočeno ako već postoji)");
  }

  console.log(newCount ? `OK — upisano novih migracija: ${newCount}` : "OK — sve već zabeleženo.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
