# Vercel Deployment Guide - Korak po Korak

## Pre Deploy-a

### 1. Proveri da li je sve commit-ovano

```bash
git status
git add .
git commit -m "Prepare for Vercel deployment"
git push
```

## Deploy na Vercel

### Korak 1: Kreiraj Vercel projekat

1. Idite na [vercel.com](https://vercel.com) i ulogujte se
2. Kliknite "Add New..." → "Project"
3. Importujte GitHub/GitLab repo (ili konektujte ga)
4. Vercel će automatski detektovati Next.js

### Korak 2: Konfiguriši Build Settings

Vercel će automatski detektovati:
- **Framework Preset**: Next.js
- **Build Command**: `npm run build` (ili `next build`)
- **Output Directory**: `.next` (automatski)
- **Install Command**: `npm install`

**Ne menjaj ništa** - Next.js 16 je automatski podržan.

### Korak 3: Setup Turso Database

**3.1. Kreiraj Turso nalog i bazu:**

1. Idite na [turso.tech](https://turso.tech) i kreirajte nalog
2. Kliknite "Create Database"
3. Unesite ime baze (npr. `mr-engines-warranty`)
4. Izaberite region (najbliži vašim korisnicima)
5. Kliknite "Create"

**3.2. Dobij connection string:**

1. U Turso dashboard-u, kliknite na vašu bazu
2. Idite na "Connect" tab
3. Kopirajte **libsql URL** (izgleda ovako):
   ```
   libsql://mr-engines-warranty-username.turso.io
   ```

**3.3. Kreiraj auth token:**

1. U Turso dashboard-u, idite na "Settings" → "Tokens"
2. Kliknite "Create Token"
3. Daj mu ime (npr. "Vercel Production")
4. Kopirajte token (samo jednom se prikazuje!)

**3.4. Formiraj DATABASE_URL:**

```
libsql://mr-engines-warranty-username.turso.io?authToken=your-token-here
```

### Korak 4: Postavi Environment Varijable na Vercel-u

U Vercel dashboard-u, idite na:
**Settings → Environment Variables**

Dodaj sledeće varijable (za **Production** environment):

#### Auth0 Varijable:
```
AUTH0_SECRET=<generate sa: openssl rand -hex 32>
AUTH0_BASE_URL=https://your-app-name.vercel.app
AUTH0_ISSUER_BASE_URL=https://your-tenant.auth0.com
AUTH0_CLIENT_ID=<iz Auth0 Dashboard>
AUTH0_CLIENT_SECRET=<iz Auth0 Dashboard>
AUTH0_MANAGEMENT_DOMAIN=your-tenant.auth0.com
AUTH0_MANAGEMENT_CLIENT_ID=<iz Auth0 M2M app>
AUTH0_MANAGEMENT_CLIENT_SECRET=<iz Auth0 M2M app>
```

#### Database:
```
DATABASE_URL=libsql://your-db-name-username.turso.io?authToken=your-token
```

#### Email (IMAP):
```
IMAP_HOST=<your-imap-host>
IMAP_PORT=993
IMAP_USER=<your-imap-user>
IMAP_PASS=<your-imap-password>
IMAP_TLS=true
```

#### Email (SMTP):
```
SMTP_HOST=<your-smtp-host>
SMTP_PORT=587
SMTP_USER=<your-smtp-user>
SMTP_PASS=<your-smtp-password>
SMTP_TLS=true
```

#### File Storage:
```
FILE_ROOT_PATH=/tmp/storage
BLOB_READ_WRITE_TOKEN=<vercel-blob-token>
```
**⚠️ VAŽNO:** 
- Ako postaviš `BLOB_READ_WRITE_TOKEN`, aplikacija će automatski koristiti Vercel Blob umesto filesystem-a
- Za dobijanje token-a: Vercel Dashboard → Settings → Storage → Create Blob Store → Copy token
- Ako ne postaviš token, koristi se filesystem (`/tmp/storage`) - fajlovi se brišu nakon redeploy-a

#### Translation (opciono):
```
TRANSLATION_PROVIDER=none
TRANSLATION_API_KEY=
TRANSLATION_BASE_URL=
TRANSLATION_MODEL=
```

#### Mail Sync:
```
MAIL_SYNC_ENABLED=true
MAIL_SYNC_INTERVAL_SECONDS=300
MAIL_SYNC_MAX_MESSAGES_PER_RUN=50
MAIL_SYNC_USE_IDLE=true
```

### Korak 5: Deploy

1. Kliknite "Deploy" u Vercel dashboard-u
2. Sačekaj da se build završi (2-5 minuta)
3. Proveri build logs za greške

### Korak 6: Pushuj Migracije na Turso

Nakon što je deploy uspešan:

**Opcija A: Koristi Vercel CLI (preporučeno)**

```bash
# Instaliraj Vercel CLI
npm i -g vercel

# Login
vercel login

# Link projekat
vercel link

# Pull environment varijable
vercel env pull .env.production

# Pushuj migracije
npx prisma migrate deploy
```

**Opcija B: Direktno sa Turso token-om**

```bash
# Postavi DATABASE_URL privremeno
export DATABASE_URL="libsql://your-db-name-username.turso.io?authToken=your-token"

# Pushuj migracije
npx prisma migrate deploy

# Generate Prisma Client
npx prisma generate
```

**Opcija C: Preko Vercel Dashboard (Build Command)**

Možeš da dodaš u Vercel build command:
```bash
npm run build && npx prisma migrate deploy
```

Ali ovo nije preporučeno jer migracije treba da se pokrenu samo jednom, ne na svaki build.

### Korak 7: File Storage - Vercel Blob (Preporučeno)

**Problem:** Vercel ima ephemeral filesystem - fajlovi se brišu nakon redeploy-a.

**Rešenje: Vercel Blob Storage (Već implementirano!)**

Aplikacija već podržava Vercel Blob storage. Samo treba da:

1. **Kreiraj Blob Store na Vercel-u:**
   - Vercel Dashboard → Settings → Storage
   - Klikni "Create" → "Blob"
   - Daj mu ime (npr. "mr-engines-warranty-files")
   - Kopiraj **Read and Write Token**

2. **Postavi environment varijablu:**
   ```
   BLOB_READ_WRITE_TOKEN=<copied-token>
   ```

3. **Redeploy aplikaciju**

To je to! Aplikacija će automatski koristiti Blob storage umesto filesystem-a.

**Napomena:** Ako ne postaviš `BLOB_READ_WRITE_TOKEN`, aplikacija će koristiti filesystem (`/tmp/storage`), ali fajlovi će se obrisati nakon redeploy-a.

#### Alternativna rešenja (ako ne želiš Vercel Blob):

- **Cloudflare R2** (besplatno do 10GB) - treba custom implementacija
- **AWS S3** - treba custom implementacija  
- **Synology NAS + MinIO** - vidi `SYNOLOGY_SETUP.md` (ako postoji)

### Korak 8: Konfiguriši Auth0 Callback URLs

1. Idite u Auth0 Dashboard → Applications → Vaša aplikacija
2. Dodaj u **Allowed Callback URLs**:
   ```
   https://your-app-name.vercel.app/api/auth/callback
   ```
3. Dodaj u **Allowed Logout URLs**:
   ```
   https://your-app-name.vercel.app
   ```
4. Dodaj u **Allowed Web Origins**:
   ```
   https://your-app-name.vercel.app
   ```

### Korak 9: Testiraj Deploy

1. Otvori `https://your-app-name.vercel.app`
2. Proveri da li se stranica učitava
3. Pokušaj da se uloguješ
4. Proveri da li dashboard radi
5. Proveri da li se podaci čitaju iz Turso baze

### Korak 10: Setup Custom Domain (opciono)

1. U Vercel dashboard-u, idite na Settings → Domains
2. Dodaj svoj domen
3. Dodaj DNS records kako Vercel kaže
4. Sačekaj da se DNS propagira (5-60 minuta)
5. Ažuriraj `AUTH0_BASE_URL` u environment varijable

## Troubleshooting

### Build Fails

**Greška: "Module not found"**
- Proveri da li su sve dependencies u `package.json`
- Pokreni `npm install` lokalno i proveri greške

**Greška: "Prisma Client not generated"**
- Dodaj u `package.json`:
```json
{
  "scripts": {
    "postinstall": "prisma generate"
  }
}
```

### Database Connection Fails

**Greška: "Can't reach database"**
- Proveri da li je `DATABASE_URL` ispravno postavljen
- Proveri da li je Turso token validan
- Proveri da li je Turso baza aktivna

### Auth0 Redirect Loop

**Problem: Beskonačna redirect petlja**
- Proveri `AUTH0_BASE_URL` - mora biti tačan URL
- Proveri `AUTH0_ISSUER_BASE_URL` - mora biti bez trailing slash
- Proveri da li su callback URLs ispravno postavljeni u Auth0

### Files Not Persisting

**Problem: Upload-ovani fajlovi nestaju**
- Ovo je normalno na Vercel-u bez cloud storage
- Migriraj na Vercel Blob, R2, ili S3 (vidi Korak 7)

## Production Checklist

- [ ] Sve environment varijable postavljene
- [ ] Turso baza kreirana i migracije push-ovane
- [ ] Auth0 callback URLs konfigurisani
- [ ] Custom domain setup (opciono)
- [ ] File storage migriran na cloud (opciono, ali preporučeno)
- [ ] Testiran login flow
- [ ] Testiran claims CRUD
- [ ] Testiran email sync (ako je omogućen)
- [ ] Monitoring setup (Vercel Analytics)

## Next Steps

1. **Monitoring**: Setup Vercel Analytics i Error Tracking
2. **Backups**: Turso automatski radi backup-ove, ali razmotri dodatne
3. **Performance**: Monitoruj Vercel Function logs za performance issues
4. **Scaling**: Vercel automatski skalira, ali proveri usage limits

## Support

- [Vercel Docs](https://vercel.com/docs)
- [Turso Docs](https://docs.turso.tech)
- [Auth0 Docs](https://auth0.com/docs)
