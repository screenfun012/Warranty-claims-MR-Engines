# 🚀 Deploy Guide - Korak po Korak

## Faza 1: Priprema Koda (5 minuta)

### Korak 1.1: Proveri da li je sve commit-ovano

```bash
cd /Users/nikola/mr-engines-warranty
git status
```

Ako vidiš izmene, commit-uj ih:

```bash
git add .
git commit -m "feat: Add Vercel Blob storage support and prepare for deployment"
git push
```

**✅ Provera:** Sve izmene su push-ovane na git.

---

## Faza 2: Setup Turso Database (10 minuta)

### Korak 2.1: Kreiraj Turso nalog

1. Idite na [https://turso.tech](https://turso.tech)
2. Kliknite "Sign Up" (možeš koristiti GitHub)
3. Potvrdi email

### Korak 2.2: Kreiraj bazu

1. U Turso dashboard-u, kliknite **"Create Database"**
2. Unesite ime: `mr-engines-warranty` (ili bilo koje ime)
3. Izaberite region (najbliži vašim korisnicima - npr. `eu-central-1` za Evropu)
4. Kliknite **"Create"**

### Korak 2.3: Dobij Connection String

1. Kliknite na vašu bazu
2. Idite na **"Connect"** tab
3. Kopirajte **libsql URL** (izgleda ovako):
   ```
   libsql://mr-engines-warranty-username.turso.io
   ```

### Korak 2.4: Kreiraj Auth Token

1. U Turso dashboard-u, idite na **"Settings"** → **"Tokens"**
2. Kliknite **"Create Token"**
3. Daj mu ime: `Vercel Production`
4. Kliknite **"Create"**
5. **VAŽNO:** Kopiraj token odmah (prikazuje se samo jednom!)
   - Ako zaboraviš, moraš da kreiraš novi

### Korak 2.5: Formiraj DATABASE_URL

Spoji libsql URL sa token-om:

```
libsql://mr-engines-warranty-username.turso.io?authToken=your-token-here
```

**✅ Provera:** Imaš kompletan `DATABASE_URL` sa token-om.

---

## Faza 3: Setup Vercel Projekat (10 minuta)

### Korak 3.1: Login na Vercel

1. Idite na [https://vercel.com](https://vercel.com)
2. Kliknite **"Sign Up"** ili **"Log In"**
3. Konektuj GitHub/GitLab account (ako već nije)

### Korak 3.2: Import Projekat

1. Kliknite **"Add New..."** → **"Project"**
2. Izaberite GitHub/GitLab repo: `mr-engines-warranty`
3. Kliknite **"Import"**

### Korak 3.3: Konfiguriši Build Settings

Vercel će automatski detektovati Next.js. **Ne menjaj ništa** - samo proveri:
- **Framework Preset:** Next.js ✅
- **Root Directory:** `./` ✅
- **Build Command:** `npm run build` ✅
- **Output Directory:** `.next` ✅

### Korak 3.4: Prvi Deploy (bez env varijabli)

1. Kliknite **"Deploy"**
2. Sačekaj da se build završi (2-5 minuta)
3. Proveri da li je build uspešan (zelena ✅)

**✅ Provera:** Build je uspešan (može biti greška zbog nedostajućih env varijabli - to je OK).

---

## Faza 4: Postavi Environment Varijable (15 minuta)

### Korak 4.1: Otvori Environment Variables

U Vercel dashboard-u:
1. Klikni na projekat
2. Idite na **"Settings"** → **"Environment Variables"**

### Korak 4.2: Dodaj Auth0 Varijable

**AUTH0_SECRET:**
```bash
# Lokalno, u terminalu:
openssl rand -hex 32
```
Kopiraj rezultat i dodaj u Vercel:
- **Key:** `AUTH0_SECRET`
- **Value:** `<rezultat iz terminala>`
- **Environment:** Production ✅

**AUTH0_BASE_URL:**
- **Key:** `AUTH0_BASE_URL`
- **Value:** `https://your-app-name.vercel.app` (zameni sa tvojim Vercel URL-om)
- **Environment:** Production ✅

**AUTH0_ISSUER_BASE_URL:**
- **Key:** `AUTH0_ISSUER_BASE_URL`
- **Value:** `https://your-tenant.auth0.com` (tvoj Auth0 domain)
- **Environment:** Production ✅

**AUTH0_CLIENT_ID:**
- **Key:** `AUTH0_CLIENT_ID`
- **Value:** `<iz Auth0 Dashboard → Applications → tvoja app → Settings>`
- **Environment:** Production ✅

**AUTH0_CLIENT_SECRET:**
- **Key:** `AUTH0_CLIENT_SECRET`
- **Value:** `<iz Auth0 Dashboard → Applications → tvoja app → Settings>`
- **Environment:** Production ✅

**AUTH0_MANAGEMENT_DOMAIN:**
- **Key:** `AUTH0_MANAGEMENT_DOMAIN`
- **Value:** `your-tenant.auth0.com` (isto kao AUTH0_ISSUER_BASE_URL, ali bez `https://`)
- **Environment:** Production ✅

**AUTH0_MANAGEMENT_CLIENT_ID:**
- **Key:** `AUTH0_MANAGEMENT_CLIENT_ID`
- **Value:** `<iz Auth0 Dashboard → Applications → Machine-to-Machine app → Settings>`
- **Environment:** Production ✅

**AUTH0_MANAGEMENT_CLIENT_SECRET:**
- **Key:** `AUTH0_MANAGEMENT_CLIENT_SECRET`
- **Value:** `<iz Auth0 Dashboard → Applications → Machine-to-Machine app → Settings>`
- **Environment:** Production ✅

### Korak 4.3: Dodaj Database Varijablu

**DATABASE_URL:**
- **Key:** `DATABASE_URL`
- **Value:** `libsql://mr-engines-warranty-username.turso.io?authToken=your-token` (iz Koraka 2.5)
- **Environment:** Production ✅

### Korak 4.4: Dodaj File Storage Varijable

**FILE_ROOT_PATH:**
- **Key:** `FILE_ROOT_PATH`
- **Value:** `/tmp/storage`
- **Environment:** Production ✅

**BLOB_READ_WRITE_TOKEN:**
- **Key:** `BLOB_READ_WRITE_TOKEN`
- **Value:** `<kreiraćemo u sledećem koraku>`
- **Environment:** Production ✅

### Korak 4.5: Dodaj Email Varijable (ako koristiš email sync)

**IMAP:**
- `IMAP_HOST` = `<tvoj-imap-host>`
- `IMAP_PORT` = `993`
- `IMAP_USER` = `<tvoj-imap-user>`
- `IMAP_PASS` = `<tvoj-imap-password>`
- `IMAP_TLS` = `true`

**SMTP:**
- `SMTP_HOST` = `<tvoj-smtp-host>`
- `SMTP_PORT` = `587`
- `SMTP_USER` = `<tvoj-smtp-user>`
- `SMTP_PASS` = `<tvoj-smtp-password>`
- `SMTP_TLS` = `true`

**✅ Provera:** Sve environment varijable su dodate (osim BLOB_READ_WRITE_TOKEN koji ćemo dodati sada).

---

## Faza 5: Setup Vercel Blob Storage (5 minuta)

### Korak 5.1: Kreiraj Blob Store

1. U Vercel dashboard-u, idite na **"Storage"** (u sidebar-u)
2. Kliknite **"Create"** → **"Blob"**
3. Unesite ime: `mr-engines-warranty-files`
4. Kliknite **"Create"**

### Korak 5.2: Dobij Read and Write Token

1. Kliknite na kreirani Blob store
2. Idite na **"Settings"** tab
3. U sekciji **"Tokens"**, kliknite **"Create Token"**
4. Daj mu ime: `Production Read Write`
5. Kliknite **"Create"**
6. **VAŽNO:** Kopiraj token odmah (prikazuje se samo jednom!)

### Korak 5.3: Dodaj Token u Environment Variables

1. Vrati se na **Settings → Environment Variables**
2. Pronađi `BLOB_READ_WRITE_TOKEN`
3. Klikni **"Edit"**
4. Upiši kopirani token
5. Klikni **"Save"**

**✅ Provera:** `BLOB_READ_WRITE_TOKEN` je postavljen.

---

## Faza 6: Pushuj Migracije na Turso (5 minuta)

### Korak 6.1: Instaliraj Vercel CLI

```bash
npm install -g vercel
```

### Korak 6.2: Login na Vercel CLI

```bash
vercel login
```

Otvorice se browser - potvrdi login.

### Korak 6.3: Link Projekat

```bash
cd /Users/nikola/mr-engines-warranty
vercel link
```

Izaberi:
- **Set up and deploy?** → `Y`
- **Which scope?** → Izaberi tvoj account
- **Link to existing project?** → `Y`
- **What's the name of your existing project?** → `mr-engines-warranty` (ili tvoje ime)

### Korak 6.4: Pull Environment Varijable

```bash
vercel env pull .env.production
```

Ovo će kreirati `.env.production` fajl sa svim environment varijablama.

### Korak 6.5: Pushuj Migracije

```bash
# Postavi DATABASE_URL privremeno
export DATABASE_URL=$(grep DATABASE_URL .env.production | cut -d '=' -f2-)

# Pushuj migracije
npx prisma migrate deploy

# Generate Prisma Client
npx prisma generate
```

**✅ Provera:** Migracije su uspešno push-ovane (nema grešaka).

---

## Faza 7: Redeploy Aplikacije (2 minuta)

### Korak 7.1: Redeploy na Vercel-u

1. U Vercel dashboard-u, idite na **"Deployments"**
2. Kliknite na **"..."** (tri tačke) pored najnovijeg deployment-a
3. Kliknite **"Redeploy"**
4. Potvrdi **"Redeploy"**

Ili jednostavno:
- Idite na **"Deployments"**
- Kliknite **"Redeploy"** na najnovijem deployment-u

### Korak 7.2: Sačekaj Build

Sačekaj da se build završi (2-5 minuta).

**✅ Provera:** Build je uspešan (zelena ✅).

---

## Faza 8: Konfiguriši Auth0 (5 minuta)

### Korak 8.1: Otvori Auth0 Dashboard

1. Idite na [https://manage.auth0.com](https://manage.auth0.com)
2. Login

### Korak 8.2: Konfiguriši Callback URLs

1. Idite na **"Applications"** → Tvoja aplikacija
2. Idite na **"Settings"** tab
3. U sekciji **"Application URIs"**, dodaj:

**Allowed Callback URLs:**
```
https://your-app-name.vercel.app/api/auth/callback
```

**Allowed Logout URLs:**
```
https://your-app-name.vercel.app
```

**Allowed Web Origins:**
```
https://your-app-name.vercel.app
```

4. Klikni **"Save Changes"**

**✅ Provera:** Auth0 callback URLs su konfigurisani.

---

## Faza 9: Testiranje (10 minuta)

### Korak 9.1: Testiraj Aplikaciju

1. Otvori `https://your-app-name.vercel.app`
2. Proveri da li se stranica učitava

### Korak 9.2: Testiraj Login

1. Klikni na "Login"
2. Proveri da li se otvara Auth0 login
3. Uloguj se
4. Proveri da li se vraćaš na aplikaciju

### Korak 9.3: Testiraj Dashboard

1. Proveri da li se dashboard učitava
2. Proveri da li se podaci prikazuju

### Korak 9.4: Testiraj File Upload

1. Idite na Claims → Otvori claim → Upload attachment
2. Upload-uj test fajl
3. Proveri da li se fajl upload-uje i prikazuje

### Korak 9.5: Proveri Blob Storage

1. U Vercel dashboard-u, idite na **"Storage"** → Tvoj Blob store
2. Proveri da li se upload-ovani fajlovi vide tamo

**✅ Provera:** Sve funkcionalnosti rade.

---

## Troubleshooting

### Problem: Build Fails

**Rešenje:**
- Proveri build logs u Vercel dashboard-u
- Proveri da li su sve environment varijable postavljene
- Proveri da li je `postinstall` script u `package.json` (trebalo bi da postoji)

### Problem: Database Connection Fails

**Rešenje:**
- Proveri da li je `DATABASE_URL` ispravno postavljen
- Proveri da li je Turso token validan
- Proveri da li je Turso baza aktivna

### Problem: Auth0 Redirect Loop

**Rešenje:**
- Proveri `AUTH0_BASE_URL` - mora biti tačan URL
- Proveri da li su callback URLs ispravno postavljeni u Auth0
- Proveri da li je `AUTH0_SECRET` postavljen

### Problem: Files Not Uploading

**Rešenje:**
- Proveri da li je `BLOB_READ_WRITE_TOKEN` postavljen
- Proveri da li je Blob store kreiran
- Proveri Vercel Function logs za greške

### Problem: Migracije Ne Rade

**Rešenje:**
```bash
# Proveri DATABASE_URL
echo $DATABASE_URL

# Ako je prazan, postavi ga:
export DATABASE_URL="libsql://..."

# Pokušaj ponovo:
npx prisma migrate deploy
```

---

## Checklist Pre Deploy-a

- [ ] Kod je push-ovan na git
- [ ] Turso baza je kreirana
- [ ] Turso token je kreiran
- [ ] Vercel projekat je kreiran
- [ ] Sve environment varijable su postavljene
- [ ] Vercel Blob store je kreiran
- [ ] Blob token je dodat u environment varijable
- [ ] Migracije su push-ovane na Turso
- [ ] Aplikacija je redeploy-ovana
- [ ] Auth0 callback URLs su konfigurisani
- [ ] Aplikacija je testirana

---

## Sledeći Koraci

1. **Custom Domain (opciono):**
   - Vercel Dashboard → Settings → Domains
   - Dodaj svoj domen
   - Ažuriraj `AUTH0_BASE_URL` sa novim domenom

2. **Monitoring:**
   - Setup Vercel Analytics
   - Setup Error Tracking

3. **Backups:**
   - Turso automatski radi backup-ove
   - Razmotri dodatne backup strategije

---

**🎉 Gotovo!** Aplikacija je deploy-ovana i spremna za korišćenje!
