# ⚠️ VAŽNO: Primeni Migraciju na Produkciji

## Problem

Migracija `20260119143744_add_claim_metadata_fields` nije primenjena na produkcijskoj bazi (Turso), što uzrokuje grešku:
```
SQLITE_UNKNOWN: SQLite error: table main.Claim has no column named yearEngineDone
```

## Rešenje

Koristi **SAFE migraciju** koja samo dodaje kolone bez brisanja podataka.

### Korak 1: Pull Environment Varijable

```bash
# Instaliraj Vercel CLI (ako već nije)
npm i -g vercel

# Login
vercel login

# Link projekat
cd /Users/nikola/mr-engines-warranty
vercel link

# Pull environment varijable
vercel env pull .env.production
```

### Korak 2: Primeni Safe Migraciju

```bash
# Postavi DATABASE_URL privremeno
export DATABASE_URL=$(grep DATABASE_URL .env.production | cut -d '=' -f2-)

# Primeni safe migraciju direktno
npx prisma db execute --file prisma/migrations/20260119150000_add_claim_metadata_fields_safe/migration.sql --schema prisma/schema.prisma

# ILI ako imaš Turso CLI:
# turso db execute your-db-name < prisma/migrations/20260119150000_add_claim_metadata_fields_safe/migration.sql
```

### Korak 3: Proveri da li je uspešno

```bash
# Proveri status migracija
npx prisma migrate status
```

### Korak 4: Ako migracija već postoji u _prisma_migrations tabeli

Ako dobiješ grešku da migracija već postoji, označi je kao primenjenu:

```bash
# Primeni migraciju bez označavanja u _prisma_migrations
npx prisma db execute --file prisma/migrations/20260119150000_add_claim_metadata_fields_safe/migration.sql --schema prisma/schema.prisma

# Zatim označi migraciju kao primenjenu
npx prisma migrate resolve --applied 20260119150000_add_claim_metadata_fields_safe
```

## Alternativno: Ručno Dodavanje Kolona

Ako migracija ne radi, možeš ručno dodati kolone:

```sql
-- Dodaj kolone direktno u Turso
ALTER TABLE "Customer" ADD COLUMN "company" TEXT;

CREATE TABLE IF NOT EXISTS "Department" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "Department_name_key" ON "Department"("name");

INSERT OR IGNORE INTO "Department" ("id", "name", "isSystem", "createdAt", "updatedAt") VALUES
  ('dept_blokovi', 'Blokovi', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('dept_klipnjace', 'Klipnjace', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('dept_glave', 'Glave', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('dept_sklapanje', 'Sklapanje', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('dept_kontrola', 'Kontrola', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('dept_magacin', 'Magacin', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('dept_rasklapanje', 'Rasklapanje', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('dept_radilice', 'Radilice', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('dept_zavrsna_kontrola', 'Zavrsna kontrola', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

ALTER TABLE "Claim" ADD COLUMN "faultDepartmentId" TEXT;
ALTER TABLE "Claim" ADD COLUMN "workerFault" TEXT;
ALTER TABLE "Claim" ADD COLUMN "yearEngineDone" INTEGER;
ALTER TABLE "Claim" ADD COLUMN "reason" TEXT;
ALTER TABLE "Claim" ADD COLUMN "isDomesticMarket" BOOLEAN NOT NULL DEFAULT false;
```

## Provera

Nakon primene migracije, proveri da li kolone postoje:

```bash
# Preko Turso CLI
turso db shell your-db-name
.schema Claim
.schema Customer
.schema Department
```

Ili preko Prisma Studio:
```bash
npx prisma studio
```

## ⚠️ Napomena

Ako dobiješ grešku da kolona već postoji, to je OK - migracija je već primenjena. Ignoriši grešku.
