-- Add assignedWorkerName field to Claim table
-- This is a simple text field for the worker who built the engine
-- Separate from assignedTo (User relation) which is for processing assignments

ALTER TABLE "Claim" ADD COLUMN "assignedWorkerName" TEXT;
