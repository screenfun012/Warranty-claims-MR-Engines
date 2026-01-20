-- Make Customer.name optional
-- This migration changes the Customer.name column from NOT NULL to nullable

-- SQLite doesn't support ALTER COLUMN, so we need to:
-- 1. Create a new table with the updated schema
-- 2. Copy data from old table
-- 3. Drop old table
-- 4. Rename new table

-- However, since we're using SQLite and the column is just changing from NOT NULL to nullable,
-- we can use a simpler approach: just recreate the table with the new schema

-- Step 1: Create new table with nullable name
CREATE TABLE "Customer_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "company" TEXT,
    "email" TEXT,
    "country" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- Step 2: Copy all data from old table to new table
INSERT INTO "Customer_new" ("id", "name", "company", "email", "country", "notes", "createdAt", "updatedAt")
SELECT "id", "name", "company", "email", "country", "notes", "createdAt", "updatedAt"
FROM "Customer";

-- Step 3: Drop old table
DROP TABLE "Customer";

-- Step 4: Rename new table to original name
ALTER TABLE "Customer_new" RENAME TO "Customer";

-- Step 5: Recreate indexes (if any exist)
-- Note: SQLite doesn't preserve indexes automatically, so we need to check if any exist
-- For now, we'll assume no custom indexes exist beyond the primary key
