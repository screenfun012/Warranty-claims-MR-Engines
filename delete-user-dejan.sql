-- Delete User with email dejan.milovanovic@mrgroup.rs
-- This is a Customer data entry, not an application user

DELETE FROM "User" WHERE email = 'dejan.milovanovic@mrgroup.rs';

-- Verify deletion
SELECT email, fullName, role FROM "User" WHERE email = 'dejan.milovanovic@mrgroup.rs';
