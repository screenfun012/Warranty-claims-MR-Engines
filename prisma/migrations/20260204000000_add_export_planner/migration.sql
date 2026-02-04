-- Export Planner tables (IF NOT EXISTS for idempotent deploy)
CREATE TABLE IF NOT EXISTS "ExportBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchCode" TEXT NOT NULL,
    "batchType" TEXT NOT NULL DEFAULT 'MR_ENGINES',
    "customName" TEXT,
    "customFields" TEXT,
    "columns" TEXT,
    "exportDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "loadTime" DATETIME,
    "notes" TEXT,
    "frozenAt" DATETIME,
    "frozenById" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "ExportBatch_batchCode_key" ON "ExportBatch"("batchCode");
CREATE INDEX IF NOT EXISTS "ExportBatch_batchType_idx" ON "ExportBatch"("batchType");

CREATE TABLE IF NOT EXISTS "ExportBatchItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchId" TEXT NOT NULL,
    "rn" TEXT NOT NULL,
    "engineNo" TEXT NOT NULL,
    "engineType" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PLANIRANO',
    "qcOk" BOOLEAN NOT NULL DEFAULT false,
    "qcNote" TEXT,
    "qcCheckedAt" DATETIME,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "details" TEXT,
    "customData" TEXT,
    "priority" TEXT,
    "dueDate" DATETIME,
    "assignedToId" TEXT,
    "startDate" DATETIME,
    "mrCode" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExportBatchItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ExportBatch" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ExportBatchItem_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "ExportBatchItem_batchId_rn_key" ON "ExportBatchItem"("batchId", "rn");
CREATE INDEX IF NOT EXISTS "ExportBatchItem_batchId_idx" ON "ExportBatchItem"("batchId");
CREATE INDEX IF NOT EXISTS "ExportBatchItem_batchId_status_idx" ON "ExportBatchItem"("batchId", "status");

CREATE TABLE IF NOT EXISTS "ExportBatchOverride" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchId" TEXT NOT NULL,
    "performedById" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "changeType" TEXT NOT NULL,
    "details" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExportBatchOverride_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ExportBatch" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ExportBatchOverride_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "ExportBatchOverride_batchId_idx" ON "ExportBatchOverride"("batchId");

CREATE TABLE IF NOT EXISTS "ExportBatchAudit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityId" TEXT,
    "userId" TEXT,
    "userEmail" TEXT,
    "details" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "ExportBatchAudit_batchId_idx" ON "ExportBatchAudit"("batchId");
CREATE INDEX IF NOT EXISTS "ExportBatchAudit_createdAt_idx" ON "ExportBatchAudit"("createdAt");
