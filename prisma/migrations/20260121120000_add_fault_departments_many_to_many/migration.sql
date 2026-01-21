-- Create junction table for many-to-many relationship between Claim and Department
CREATE TABLE IF NOT EXISTS "_ClaimFaultDepartments" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    FOREIGN KEY ("A") REFERENCES "Claim" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("B") REFERENCES "Department" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Create unique index to prevent duplicate relationships
CREATE UNIQUE INDEX IF NOT EXISTS "_ClaimFaultDepartments_AB_unique" ON "_ClaimFaultDepartments"("A", "B");

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS "_ClaimFaultDepartments_B_index" ON "_ClaimFaultDepartments"("B");

-- Migrate existing single faultDepartmentId to many-to-many relationship
-- This will preserve existing data
INSERT OR IGNORE INTO "_ClaimFaultDepartments" ("A", "B")
SELECT "id", "faultDepartmentId" 
FROM "Claim" 
WHERE "faultDepartmentId" IS NOT NULL;
