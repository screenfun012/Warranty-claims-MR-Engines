# Turso Database Setup za Vercel Deployment

## Šta je Turso?

Turso je cloud-native SQLite baza podataka koja radi sa Prisma SQLite provider-om bez ikakvih promena u kodu. Idealno za Vercel deployment.

## Setup koraci

### 1. Kreiraj Turso nalog i bazu

1. Idite na [turso.tech](https://turso.tech) i kreirajte nalog
2. Kreirajte novu bazu (database)
3. Kreirajte novi token za pristup bazi

### 2. Dobij connection string

U Turso dashboard-u:
- Idite na vašu bazu
- Kliknite na "Connect" ili "Connection String"
- Kopirajte `libsql://` URL (izgleda ovako: `libsql://your-db-name-username.turso.io`)

### 3. Postavi environment varijable na Vercel-u

U Vercel dashboard-u, idite na Settings → Environment Variables i dodajte:

```
DATABASE_URL=libsql://your-db-name-username.turso.io?authToken=your-auth-token
```

**VAŽNO:** 
- Ne stavljajte `DATABASE_URL` u `.env.local` za production (koristi se samo za local dev)
- Na Vercel-u postavite samo production environment varijablu

### 4. Push migracije na Turso

Nakon što postavite `DATABASE_URL` na Vercel-u, možete da pushujete migracije:

```bash
# Prvo, postavite DATABASE_URL lokalno (privremeno)
export DATABASE_URL="libsql://your-db-name-username.turso.io?authToken=your-auth-token"

# Pushuj migracije
npx prisma migrate deploy
```

**ILI** možete da koristite Vercel CLI:

```bash
vercel env pull .env.production
npx prisma migrate deploy
```

### 5. Generate Prisma Client

```bash
npx prisma generate
```

## Local Development

Za local development, nastavite da koristite SQLite:

```bash
# .env.local
DATABASE_URL=file:./dev.db
```

## Migracija postojećih podataka

Ako imate podatke u lokalnoj SQLite bazi koje želite da migrirate na Turso:

1. Exportuj podatke iz lokalne baze:
```bash
npx prisma db pull  # Ovo će kreirati backup
```

2. Pushuj migracije na Turso (korak 4 iznad)

3. Importuj podatke (ako je potrebno, koristite Prisma Studio ili custom script)

## Troubleshooting

### "Database is locked" greška
- Turso koristi connection pooling, ovo ne bi trebalo da se dešava
- Proverite da li imate više instanci koje pokušavaju da pišu istovremeno

### Connection timeout
- Proverite da li je `authToken` ispravan
- Proverite da li je baza kreirana i aktivna u Turso dashboard-u

### Migracije ne rade
- Proverite da li je `DATABASE_URL` ispravno postavljen
- Koristite `npx prisma migrate deploy` umesto `npx prisma migrate dev` za production

## Besplatni plan

Turso besplatni plan uključuje:
- 500MB storage
- 1 milijardu row reads/mesec
- 10 miliona row writes/mesec
- Unlimited databases

## Dodatne resurse

- [Turso Documentation](https://docs.turso.tech)
- [Prisma + Turso Guide](https://docs.turso.tech/sdk/prisma/get-started-nextjs)
