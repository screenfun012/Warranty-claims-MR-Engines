# 🚨 Primeni Migraciju na Turso SADA

## Brzi način (ako imaš DATABASE_URL)

```bash
# 1. Postavi DATABASE_URL (iz Vercel environment varijabli ili Turso dashboard-a)
export DATABASE_URL="libsql://your-db-name-username.turso.io?authToken=your-token"

# 2. Primeni migraciju
./apply-migration-to-turso.sh
```

## Alternativno: Preko Turso CLI

```bash
# 1. Login na Turso
turso auth login

# 2. Listuj baze
turso db list

# 3. Primeni migraciju direktno
turso db execute YOUR_DB_NAME < prisma/migrations/20260119150000_add_claim_metadata_fields_safe/migration.sql
```

## Kako dobiti DATABASE_URL?

### Opcija 1: Iz Vercel Dashboard-a
1. Idi na Vercel Dashboard → Settings → Environment Variables
2. Kopiraj `DATABASE_URL` vrednost
3. Postavi kao environment varijablu:
   ```bash
   export DATABASE_URL="libsql://..."
   ```

### Opcija 2: Iz Turso Dashboard-a
1. Idi na [turso.tech](https://turso.tech) → Dashboard
2. Izaberi svoju bazu
3. Klikni "Connect" ili "Connection String"
4. Kopiraj `libsql://` URL
5. Dodaj `?authToken=your-token` na kraju

### Opcija 3: Preko Vercel CLI (ako je instaliran)
```bash
npm i -g vercel
vercel login
vercel link
vercel env pull .env.production
export DATABASE_URL=$(grep DATABASE_URL .env.production | cut -d '=' -f2-)
```

## Provera nakon primene

```bash
# Proveri da li kolone postoje
npx prisma studio
# Otvori Claim tabelu i proveri da li postoje nove kolone
```

## ⚠️ VAŽNO

- Ova migracija je **SAFE** - ne briše postojeće podatke
- Možeš je pokrenuti više puta bez problema
- Ako dobiješ grešku da kolona već postoji, ignoriši je - migracija je već primenjena
