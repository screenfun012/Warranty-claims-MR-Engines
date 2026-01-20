-- Add customerNumber field to Claim table
-- This migration adds a new optional field for customer number

ALTER TABLE "Claim" ADD COLUMN "customerNumber" TEXT;
