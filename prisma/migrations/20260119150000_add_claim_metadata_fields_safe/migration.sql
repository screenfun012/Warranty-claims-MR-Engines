-- Safe migration: Only add columns, don't recreate table

-- Add company column to Customer
ALTER TABLE "Customer" ADD COLUMN "company" TEXT;

-- Create Department table (if not exists)
CREATE TABLE IF NOT EXISTS "Department" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- Create unique index on Department name (if not exists)
CREATE UNIQUE INDEX IF NOT EXISTS "Department_name_key" ON "Department"("name");

-- Insert default system departments (only if they don't exist)
INSERT OR IGNORE INTO "Department" ("id", "name", "isSystem", "createdAt", "updatedAt") VALUES
  ('dept_blokovi', 'Blokovi', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('dept_klipnjace', 'Klipnjace', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('dept_glave', 'Glave', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('dept_sklapanje', 'Sklapanje', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('dept_kontrola', 'Kontrola', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('dept_magacin', 'Magacin', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('dept_rasklapanje', 'Rasklapanje', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('dept_radilice', 'Radilice', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('dept_zavrsna_kontrola', 'Zavrsna kontrola', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Add new columns to Claim table
-- Note: These will fail if columns already exist, but that's OK for SQLite
-- We'll handle errors gracefully in the application

-- Add faultDepartmentId column
ALTER TABLE "Claim" ADD COLUMN "faultDepartmentId" TEXT;

-- Add workerFault column
ALTER TABLE "Claim" ADD COLUMN "workerFault" TEXT;

-- Add yearEngineDone column
ALTER TABLE "Claim" ADD COLUMN "yearEngineDone" INTEGER;

-- Add reason column
ALTER TABLE "Claim" ADD COLUMN "reason" TEXT;

-- Add isDomesticMarket column with default value
ALTER TABLE "Claim" ADD COLUMN "isDomesticMarket" BOOLEAN NOT NULL DEFAULT false;
