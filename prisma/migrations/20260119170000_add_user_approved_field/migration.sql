-- Add approved column to User table
-- New users will need approval from SUPER_ADMIN before accessing the app

-- Add approved column with default false
ALTER TABLE "User" ADD COLUMN "approved" INTEGER NOT NULL DEFAULT 0;

-- Approve all existing users (they were already using the system)
UPDATE "User" SET "approved" = 1;

-- Update default role from OPERATOR to VIEWER for new users
-- This is handled in Prisma schema, but documenting the change here
