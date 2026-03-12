-- AlterTable
ALTER TABLE "Attachment" ADD COLUMN "translationsJson" TEXT;

-- AlterTable
ALTER TABLE "ClientDocument" ADD COLUMN "translationsJson" TEXT;

-- AlterTable (Claim summary languages)
ALTER TABLE "Claim" ADD COLUMN "summaryIt" TEXT;
ALTER TABLE "Claim" ADD COLUMN "summaryPl" TEXT;
ALTER TABLE "Claim" ADD COLUMN "summaryDa" TEXT;
ALTER TABLE "Claim" ADD COLUMN "summaryEs" TEXT;
ALTER TABLE "Claim" ADD COLUMN "summarySv" TEXT;
