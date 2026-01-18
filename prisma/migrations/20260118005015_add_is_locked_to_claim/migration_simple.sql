-- Simple migration: Just add the column
-- SQLite/Turso supports adding columns directly, no need for complex table recreation
ALTER TABLE "Claim" ADD COLUMN "isLocked" BOOLEAN NOT NULL DEFAULT false;
