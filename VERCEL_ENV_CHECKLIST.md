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
- [ ] `WEBDAV_URL` - WebDAV server URL (npr. https://your-synology.dyndns.org:5006)
- [ ] `WEBDAV_USERNAME` - WebDAV korisničko ime
- [ ] `WEBDAV_PASSWORD` - WebDAV lozinka
- [ ] `WEBDAV_BASE_PATH` - Base path na Synology-u (npr. /Warranty/REKLAMACIJE)

### Mail Sync (opciono)
- [ ] `MAIL_SYNC_ENABLED` - true (default)
- [ ] `MAIL_SYNC_INTERVAL_SECONDS` - 300 (default)
- [ ] `MAIL_SYNC_MAX_MESSAGES_PER_RUN` - 50 (default)
- [ ] `MAIL_SYNC_USE_IDLE` - true (default, ali na Vercel-u ne radi)

### Translation (opciono)
- [ ] `TRANSLATION_PROVIDER` - none (default) ili deepl/openai/google
- [ ] `TRANSLATION_API_KEY` - API key za translation provider (ako koristiš)
- [ ] `TRANSLATION_BASE_URL` - Base URL za translation API (ako koristiš)
- [ ] `TRANSLATION_MODEL` - Model za translation (ako koristiš)

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
