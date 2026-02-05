-- AlterTable: add isPrivate to ExportBatch
ALTER TABLE "ExportBatch" ADD COLUMN "isPrivate" BOOLEAN NOT NULL DEFAULT 0;

-- CreateIndex for visibility filter
CREATE INDEX "ExportBatch_isPrivate_createdById_idx" ON "ExportBatch"("isPrivate", "createdById");

-- CreateTable: column order preference per user per batch type
CREATE TABLE "ExportPlannerColumnPreference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "batchType" TEXT NOT NULL,
    "columnOrder" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExportPlannerColumnPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ExportPlannerColumnPreference_userId_batchType_key" ON "ExportPlannerColumnPreference"("userId", "batchType");
CREATE INDEX "ExportPlannerColumnPreference_userId_idx" ON "ExportPlannerColumnPreference"("userId");
