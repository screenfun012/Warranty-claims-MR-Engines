-- Add threadStatus to EmailThread: NEW_CLAIM = prvi mail (reklamacija), HAS_REPLIES = dopisivanje
ALTER TABLE "EmailThread" ADD COLUMN "threadStatus" TEXT;
