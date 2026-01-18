# Turso Migration: Add isLocked field to Claim table

## Problem
The `isLocked` field was added to the Claim model, but the migration hasn't been applied to the production Turso database.

Error: `SQLITE_UNKNOWN: SQLite error: table main.Claim has no column named isLocked`

## Solution: Apply Migration to Turso

### Option 1: Using Turso CLI (Recommended)

```bash
# Make sure you have Turso CLI installed
# If not: curl -sSfL https://get.tur.so/install.sh | bash

# Login to Turso (if not already logged in)
turso auth login

# List your databases
turso db list

# Execute the migration SQL directly
turso db shell <YOUR_DATABASE_NAME> << EOF
-- Add isLocked column to Claim table
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Claim" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "claimCodeRaw" TEXT,
    "claimPrefix" TEXT,
    "claimNumber" INTEGER,
    "claimYear" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "claimAcceptanceStatus" TEXT,
    "processingEmailSentAt" DATETIME,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "customerId" TEXT,
    "workOrderId" TEXT,
    "engineType" TEXT,
    "mrEngineCode" TEXT,
    "customerReference" TEXT,
    "invoiceNumber" TEXT,
    "assignedToId" TEXT,
    "serverFolderPath" TEXT,
    "summarySr" TEXT,
    "summaryEn" TEXT,
    "summaryDe" TEXT,
    "summaryFr" TEXT,
    "summaryNl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Claim_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Claim_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Claim_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Claim" ("assignedToId", "claimAcceptanceStatus", "claimCodeRaw", "claimNumber", "claimPrefix", "claimYear", "createdAt", "customerId", "customerReference", "engineType", "id", "invoiceNumber", "mrEngineCode", "processingEmailSentAt", "serverFolderPath", "status", "summaryDe", "summaryEn", "summaryFr", "summaryNl", "summarySr", "updatedAt", "workOrderId") SELECT "assignedToId", "claimAcceptanceStatus", "claimCodeRaw", "claimNumber", "claimPrefix", "claimYear", "createdAt", "customerId", "customerReference", "engineType", "id", "invoiceNumber", "mrEngineCode", "processingEmailSentAt", "serverFolderPath", "status", "summaryDe", "summaryEn", "summaryFr", "summaryNl", "summarySr", "updatedAt", "workOrderId" FROM "Claim";
DROP TABLE "Claim";
ALTER TABLE "new_Claim" RENAME TO "Claim";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
EOF
```

### Option 2: Using SQL directly (Simpler)

If you have the database connection URL, you can execute this simpler SQL:

```sql
-- Just add the column (SQLite/Turso supports adding columns directly)
ALTER TABLE "Claim" ADD COLUMN "isLocked" BOOLEAN NOT NULL DEFAULT false;
```

**Note:** This simpler approach works because SQLite (and Turso) allows adding columns directly. The Prisma migration uses a more complex approach (create new table, copy data, drop old table) which is safer but more complex.

### Option 3: Using Vercel CLI (if deployed there)

If you're using Vercel and have the database connection info in environment variables:

```bash
# Get the database URL from Vercel
vercel env pull .env.production

# Then use Turso CLI to execute the migration
# (same as Option 1)
```

## Verification

After applying the migration, verify it worked:

```bash
turso db shell <YOUR_DATABASE_NAME> << EOF
SELECT sql FROM sqlite_master WHERE type='table' AND name='Claim';
EOF
```

You should see `isLocked` in the table schema.

## Important Notes

1. **Backup first**: Always backup your production database before running migrations.
2. **Default value**: All existing claims will have `isLocked = false` (default value).
3. **Closed claims**: Claims with `status = 'CLOSED'` will be treated as locked by default (via application logic), even if `isLocked = false` in the database.
4. **No downtime**: SQLite/Turso migrations typically don't cause downtime, but be cautious with large tables.
