-- AlterTable
ALTER TABLE "Customer" ADD COLUMN "company" TEXT;

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
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
    "faultDepartmentId" TEXT,
    "workerFault" TEXT,
    "yearEngineDone" INTEGER,
    "reason" TEXT,
    "isDomesticMarket" BOOLEAN NOT NULL DEFAULT false,
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
    CONSTRAINT "Claim_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Claim_faultDepartmentId_fkey" FOREIGN KEY ("faultDepartmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Claim" ("assignedToId", "claimAcceptanceStatus", "claimCodeRaw", "claimNumber", "claimPrefix", "claimYear", "createdAt", "customerId", "customerReference", "engineType", "id", "invoiceNumber", "isLocked", "mrEngineCode", "processingEmailSentAt", "serverFolderPath", "status", "summaryDe", "summaryEn", "summaryFr", "summaryNl", "summarySr", "updatedAt", "workOrderId") SELECT "assignedToId", "claimAcceptanceStatus", "claimCodeRaw", "claimNumber", "claimPrefix", "claimYear", "createdAt", "customerId", "customerReference", "engineType", "id", "invoiceNumber", "isLocked", "mrEngineCode", "processingEmailSentAt", "serverFolderPath", "status", "summaryDe", "summaryEn", "summaryFr", "summaryNl", "summarySr", "updatedAt", "workOrderId" FROM "Claim";
DROP TABLE "Claim";
ALTER TABLE "new_Claim" RENAME TO "Claim";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Department_name_key" ON "Department"("name");

-- Insert default system departments
INSERT INTO "Department" ("id", "name", "isSystem", "createdAt", "updatedAt") VALUES
  ('dept_blokovi', 'Blokovi', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('dept_klipnjace', 'Klipnjace', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('dept_glave', 'Glave', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('dept_sklapanje', 'Sklapanje', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('dept_kontrola', 'Kontrola', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('dept_magacin', 'Magacin', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('dept_rasklapanje', 'Rasklapanje', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('dept_radilice', 'Radilice', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('dept_zavrsna_kontrola', 'Zavrsna kontrola', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
