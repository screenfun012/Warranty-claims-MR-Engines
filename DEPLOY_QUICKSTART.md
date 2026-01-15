# 🚀 Quick Start - Vercel Deploy

## 1. Push na Git

```bash
git add .
git commit -m "Prepare for Vercel deployment"
git push
```

## 2. Kreiraj Vercel Projekat

1. Idite na [vercel.com](https://vercel.com) → "Add New Project"
2. Importuj GitHub repo
3. Kliknite "Deploy" (za sada, bez env varijabli)

## 3. Setup Turso Database

1. [turso.tech](https://turso.tech) → Create Database
2. Kopiraj **libsql URL** i **auth token**
3. Formiraj: `libsql://your-db.turso.io?authToken=token`

## 4. Postavi Environment Varijable

U Vercel: **Settings → Environment Variables**

### Obavezno:
```
DATABASE_URL=libsql://your-db.turso.io?authToken=token
AUTH0_SECRET=<openssl rand -hex 32>
AUTH0_BASE_URL=https://your-app.vercel.app
AUTH0_ISSUER_BASE_URL=https://your-tenant.auth0.com
AUTH0_CLIENT_ID=<iz Auth0>
AUTH0_CLIENT_SECRET=<iz Auth0>
AUTH0_MANAGEMENT_DOMAIN=your-tenant.auth0.com
AUTH0_MANAGEMENT_CLIENT_ID=<iz Auth0 M2M>
AUTH0_MANAGEMENT_CLIENT_SECRET=<iz Auth0 M2M>
FILE_ROOT_PATH=/tmp/storage
BLOB_READ_WRITE_TOKEN=<vercel-blob-token>
```
**Napomena:** Ako postaviš `BLOB_READ_WRITE_TOKEN`, aplikacija automatski koristi Vercel Blob umesto filesystem-a. Za dobijanje token-a: Vercel Dashboard → Storage → Create Blob Store.
```

### Email (ako koristiš):
```
IMAP_HOST=...
IMAP_PORT=993
IMAP_USER=...
IMAP_PASS=...
SMTP_HOST=...
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
```

## 5. Pushuj Migracije

```bash
# Instaliraj Vercel CLI
npm i -g vercel

# Login i link
vercel login
vercel link

# Pull env varijable
vercel env pull .env.production

# Pushuj migracije
npx prisma migrate deploy
```

## 6. Redeploy

U Vercel dashboard-u: **Deployments → Redeploy**

## 7. Konfiguriši Auth0

Auth0 Dashboard → Applications → Vaša app:

**Allowed Callback URLs:**
```
https://your-app.vercel.app/api/auth/callback
```

**Allowed Logout URLs:**
```
https://your-app.vercel.app
```

## ✅ Gotovo!

Otvori `https://your-app.vercel.app` i testiraj.

---

**Detaljne instrukcije:** Pogledaj `VERCEL_DEPLOYMENT.md`
