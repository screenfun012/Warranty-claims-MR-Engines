-- CreateTable
CREATE TABLE "DeletedEmailMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "messageId" TEXT NOT NULL,
    "threadId" TEXT,
    "deletedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedBy" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "DeletedEmailMessage_messageId_key" ON "DeletedEmailMessage"("messageId");

-- CreateIndex
CREATE INDEX "DeletedEmailMessage_messageId_idx" ON "DeletedEmailMessage"("messageId");
