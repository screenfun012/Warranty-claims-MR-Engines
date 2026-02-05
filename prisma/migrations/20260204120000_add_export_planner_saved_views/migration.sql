-- CreateTable
CREATE TABLE "ExportPlannerSavedView" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "batchType" TEXT,
    "mineOnly" BOOLEAN NOT NULL DEFAULT false,
    "sortBy" TEXT NOT NULL DEFAULT 'dateDesc',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExportPlannerSavedView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ExportPlannerSavedView_userId_idx" ON "ExportPlannerSavedView"("userId");
