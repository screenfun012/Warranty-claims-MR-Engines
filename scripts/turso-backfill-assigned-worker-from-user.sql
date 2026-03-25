-- Turso / SQLite: kopiraj ime radnika iz User u Claim.assignedWorkerName
-- gde je tekstualno polje prazno a postoji assignedToId (legacy veza).
-- Pokretanje: turso db shell <ime-baze> < scripts/turso-backfill-assigned-worker-from-user.sql
-- ili nalepi u Turso SQL konzolu.

UPDATE Claim
SET assignedWorkerName = (
  SELECT TRIM(User.fullName)
  FROM User
  WHERE User.id = Claim.assignedToId
)
WHERE assignedToId IS NOT NULL
  AND (assignedWorkerName IS NULL OR TRIM(assignedWorkerName) = '')
  AND EXISTS (
    SELECT 1 FROM User
    WHERE User.id = Claim.assignedToId
      AND User.fullName IS NOT NULL
      AND TRIM(User.fullName) != ''
  );

-- Opciono: ako želiš da "datum prijema" u bazi nije NULL za stare redove
-- (lista ionako koristi createdAt kao rezervu dok je NULL):
-- UPDATE Claim SET claimArrivalDate = createdAt WHERE claimArrivalDate IS NULL;
