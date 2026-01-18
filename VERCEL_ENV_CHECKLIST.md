# Vercel Environment Variables Checklist

## ✅ Obavezno postaviti na Vercel-u:

### Database
- [ ] `DATABASE_URL` - Turso connection string (libsql://...)

### Auth0
- [ ] `AUTH0_SECRET` - Random secret (možeš generisati sa `openssl rand -hex 32`)
- [ ] `AUTH0_BASE_URL` - URL aplikacije na Vercel-u (https://your-app.vercel.app)
- [ ] `AUTH0_ISSUER_BASE_URL` - Auth0 domain (https://your-tenant.auth0.com)
- [ ] `AUTH0_CLIENT_ID` - Auth0 application client ID
- [ ] `AUTH0_CLIENT_SECRET` - Auth0 application client secret

### Email (IMAP) - za prijem mailova
- [ ] `IMAP_SERVER` - mail.mrgroup.rs
- [ ] `IMAP_PORT` - 993
- [ ] `IMAP_USER_EMAIL` - claims@mrgroup.rs
- [ ] `IMAP_USER_PASS` - Lozinka za email nalog
- [ ] `IMAP_TLS` - true

### Email (SMTP) - za slanje mailova
- [ ] `SMTP_SERVER` - mail.mrgroup.rs
- [ ] `SMTP_PORT` - 465
- [ ] `SMTP_USER_EMAIL` - claims@mrgroup.rs
- [ ] `SMTP_USER_PASS` - Lozinka za email nalog
- [ ] `SMTP_TLS` - true

### WebDAV - za čuvanje priloga (obavezno!)
- [ ] `WEBDAV_URL` - WebDAV server URL BEZ `/webdav` na kraju (npr. https://your-synology.dyndns.org:5006 ili https://192-168-100-226.mrengines.direct.quickconnect.to:5006)
  - **VAŽNO:** Ne stavljaj `/webdav` na kraju URL-a!
  - Za QuickConnect: `https://192-168-100-226.mrengines.direct.quickconnect.to:5006`
  - Za direktan pristup: `https://your-synology.dyndns.org:5006`
- [ ] `WEBDAV_USERNAME` - WebDAV korisničko ime (npr. webdav-user)
- [ ] `WEBDAV_PASSWORD` - WebDAV lozinka
- [ ] `WEBDAV_BASE_PATH` - Base path na Synology-u (npr. /Warranty/REKLAMACIJE ili /volume10/Warranty/REKLAMACIJE)
  - **NAPOMENA:** Ovo je putanja gde će se fajlovi čuvati na Synology-u

### Mail Sync (opciono)
- [ ] `MAIL_SYNC_ENABLED` - true (default)
- [ ] `MAIL_SYNC_INTERVAL_SECONDS` - 300 (default)
- [ ] `MAIL_SYNC_MAX_MESSAGES_PER_RUN` - 50 (default)
- [ ] `MAIL_SYNC_USE_IDLE` - true (default, ali na Vercel-u ne radi)

### Translation (opciono - potrebno za automatsko prevodenje)
**Napomena:** Bez ovih varijabli, prevod **neće raditi**. Ako želiš da omogućiš prevod, moraš postaviti `TRANSLATION_PROVIDER` i `TRANSLATION_API_KEY`.

**Opcija 1: DeepL (Preporučeno za evropske jezike)**
- [ ] `TRANSLATION_PROVIDER` - `deepl`
- [ ] `TRANSLATION_API_KEY` - DeepL API key (možeš dobiti besplatno na https://www.deepl.com/pro-api)
- [ ] `TRANSLATION_BASE_URL` - `https://api-free.deepl.com/v2/translate` (za free API) ili `https://api.deepl.com/v2/translate` (za paid), ili ostavi prazno

**Opcija 2: OpenAI (Preporučeno za srpski jezik)**
- [ ] `TRANSLATION_PROVIDER` - `openai`
- [ ] `TRANSLATION_API_KEY` - OpenAI API key (možeš dobiti na https://platform.openai.com/api-keys)
- [ ] `TRANSLATION_BASE_URL` - `https://api.openai.com/v1/chat/completions` (ili ostavi prazno - default)
- [ ] `TRANSLATION_MODEL` - `gpt-3.5-turbo` (ili `gpt-4` za bolji kvalitet, ili ostavi prazno - default je gpt-3.5-turbo)

**Onemogući prevod:**
- [ ] `TRANSLATION_PROVIDER` - `none` (default - prevod neće raditi)

**Detaljne instrukcije:** Pogledaj `TRANSLATION_SETUP.md` za detaljne korake kako da dobiješ API key i konfigurišeš prevod.

### File Storage (opciono - samo ako ne koristiš WebDAV)
- [ ] `FILE_ROOT_PATH` - ./storage (default, ali ne radi na Vercel-u)
- [ ] `BLOB_READ_WRITE_TOKEN` - Vercel Blob token (ako koristiš Vercel Blob umesto WebDAV)

## ⚠️ VAŽNO:

1. **Nakon promene environment varijabli, moraš da uradiš REDEPLOY!**
   - Idi u Vercel Dashboard → Deployments
   - Klikni na tri tačke (⋯) na poslednjem deployment-u
   - Klikni "Redeploy"

2. **Proveri da li su sve varijable postavljene:**
   - Idi u Vercel Dashboard → Settings → Environment Variables
   - Proveri da li su sve obavezne varijable postavljene za **Production** environment

3. **Ako nešto ne radi, proveri logove:**
   - Idi u Vercel Dashboard → Deployments
   - Klikni na poslednji deployment
   - Proveri "Runtime Logs" i "Build Logs"
