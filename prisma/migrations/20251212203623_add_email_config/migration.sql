-- CreateTable
CREATE TABLE "EmailConfig" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "imapHost" TEXT NOT NULL,
    "imapPort" INTEGER NOT NULL DEFAULT 993,
    "imapUser" TEXT NOT NULL,
    "imapPass" TEXT NOT NULL,
    "imapTls" BOOLEAN NOT NULL DEFAULT true,
    "smtpHost" TEXT NOT NULL,
    "smtpPort" INTEGER NOT NULL DEFAULT 587,
    "smtpUser" TEXT NOT NULL,
    "smtpPass" TEXT NOT NULL,
    "smtpTls" BOOLEAN NOT NULL DEFAULT true,
    "rememberCredentials" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
