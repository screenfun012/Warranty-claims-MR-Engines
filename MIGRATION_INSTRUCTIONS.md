# Instrukcije za Primenu Migracije na Produkciji

## Migracija: DeletedEmailMessage tabela

### Šta je migracija?
Migracija dodaje tabelu `DeletedEmailMessage` koja prati obrisane email poruke, tako da se ne kreiraju ponovo tokom sync-a.

### Kako primeniti migraciju?

#### Opcija 1: Preko Vercel CLI (Preporučeno)

```bash
# 1. Instaliraj Vercel CLI (ako već nije instaliran)
npm i -g vercel

# 2. Login na Vercel
vercel login

# 3. Link projekat (ako već nije linkovan)
cd /Users/nikola/mr-engines-warranty
vercel link

# 4. Pull environment varijable sa Vercel-a
vercel env pull .env.production

# 5. Postavi DATABASE_URL iz .env.production
export DATABASE_URL=$(grep DATABASE_URL .env.production | cut -d '=' -f2-)

# 6. Primeni migraciju
npx prisma migrate deploy

# 7. Generate Prisma Client (opciono, već je u postinstall)
npx prisma generate
```

#### Opcija 2: Direktno sa Turso token-om

```bash
# 1. Postavi DATABASE_URL sa Turso token-om
export DATABASE_URL="libsql://your-db-name-username.turso.io?authToken=your-auth-token"

# 2. Primeni migraciju
npx prisma migrate deploy

# 3. Generate Prisma Client
npx prisma generate
```

#### Opcija 3: Preko Turso CLI (Ako imaš Turso CLI instaliran)

```bash
# 1. Turso login
turso auth login

# 2. List baze
turso db list

# 3. Primeni migraciju direktno
cd /Users/nikola/mr-engines-warranty
turso db execute your-db-name < prisma/migrations/20260117221610_add_deleted_email_message/migration.sql
```

### Provera da li je migracija primenjena

```bash
# Proveri da li tabela postoji
npx prisma studio
# Otvori u browseru i proveri da li postoji DeletedEmailMessage tabela
```

Ili direktno preko SQL:

```bash
# Ako koristiš Turso CLI
turso db shell your-db-name
# Zatim u SQL shell-u:
.tables
# Trebalo bi da vidiš DeletedEmailMessage u listi tabela
```

### Ako migracija ne prođe

Ako dobiješ grešku da tabela već postoji ili nešto slično, možete da je ručno dodate:

```sql
-- Kreiraj tabelu direktno
CREATE TABLE IF NOT EXISTS "DeletedEmailMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "messageId" TEXT NOT NULL,
    "threadId" TEXT,
    "deletedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedBy" TEXT
);

-- Kreiraj indexe
CREATE UNIQUE INDEX IF NOT EXISTS "DeletedEmailMessage_messageId_key" ON "DeletedEmailMessage"("messageId");
CREATE INDEX IF NOT EXISTS "DeletedEmailMessage_messageId_idx" ON "DeletedEmailMessage"("messageId");
```

### Nakon migracije

1. ✅ Tabela `DeletedEmailMessage` je kreirana
2. ✅ Sync će automatski koristiti ovu tabelu da ne kreira ponovo obrisane mailove
3. ✅ Delete endpoint automatski snima obrisane messageId-ove u ovu tabelu

### Napomena

Ako migracija ne prođe odmah, to nije problem - aplikacija će raditi normalno, samo neće proveravati obrisane mailove dok se migracija ne primi. Sync će raditi, ali će obrisani mailovi možda biti ponovo kreirani (što se neće desiti kada se migracija primi).
