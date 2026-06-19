-- Performance indexes. All IF NOT EXISTS so this is safe to re-run and never
-- touches row data. Speeds up the claims list (sort/filter) and claim detail
-- (joins by claimId / FK lookups) on Turso/libSQL.

-- Claim: list is ordered by createdAt desc and filtered by status/acceptance/customer
CREATE INDEX IF NOT EXISTS "Claim_createdAt_idx" ON "Claim"("createdAt");
CREATE INDEX IF NOT EXISTS "Claim_status_createdAt_idx" ON "Claim"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "Claim_claimAcceptanceStatus_idx" ON "Claim"("claimAcceptanceStatus");
CREATE INDEX IF NOT EXISTS "Claim_customerId_idx" ON "Claim"("customerId");
CREATE INDEX IF NOT EXISTS "Claim_workOrderId_idx" ON "Claim"("workOrderId");
CREATE INDEX IF NOT EXISTS "Claim_assignedToId_idx" ON "Claim"("assignedToId");

-- Foreign-key lookups used by the claim detail includes
CREATE INDEX IF NOT EXISTS "EmailThread_claimId_idx" ON "EmailThread"("claimId");
CREATE INDEX IF NOT EXISTS "EmailMessage_emailThreadId_idx" ON "EmailMessage"("emailThreadId");
CREATE INDEX IF NOT EXISTS "Attachment_claimId_idx" ON "Attachment"("claimId");
CREATE INDEX IF NOT EXISTS "Attachment_emailMessageId_idx" ON "Attachment"("emailMessageId");
CREATE INDEX IF NOT EXISTS "Photo_claimId_idx" ON "Photo"("claimId");
CREATE INDEX IF NOT EXISTS "ClientDocument_claimId_idx" ON "ClientDocument"("claimId");
CREATE INDEX IF NOT EXISTS "ReportSection_claimId_idx" ON "ReportSection"("claimId");
