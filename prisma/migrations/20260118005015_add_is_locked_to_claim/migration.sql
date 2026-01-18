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
