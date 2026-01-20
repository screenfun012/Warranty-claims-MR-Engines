-- Add date fields to Claim table
-- dateEngineDone: Date when engine was made (replaces yearEngineDone as primary field)
-- claimArrivalDate: Date when claim arrived

ALTER TABLE "Claim" ADD COLUMN "dateEngineDone" DATETIME;
ALTER TABLE "Claim" ADD COLUMN "claimArrivalDate" DATETIME;
