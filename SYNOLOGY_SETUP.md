# Synology Setup Guide

Ovaj vodič objašnjava kako da konfigurišete Synology NAS za korišćenje sa MR Engines Warranty aplikacijom.

## 📋 Pregled

Aplikacija može koristiti Synology za:
1. **Email Server** (Synology MailPlus Server) - za `claims@mrgroup` email
2. **File Storage** (WebDAV Server) - za čuvanje email attachmenta
3. **Container Manager** (opciono) - za dodatne servise ili pokretanje aplikacije direktno na Synology-u

## 🔧 Faza 1: Setup Synology MailPlus Server

### Korak 1.1: Instaliraj Synology MailPlus Server

1. Otvori **Package Center** na Synology NAS-u
2. Pronađi **Synology MailPlus Server**
3. Klikni **Install**
4. Sačekaj da se instalacija završi

### Korak 1.2: Konfiguriši Domain

1. Idi u **Control Panel** → **Domain/LDAP**
2. Ako već nemaš domen, možeš koristiti:
   - **QuickConnect ID** (npr. `yourname.synology.me`)
   - **DDNS** (ako imaš)
   - **Lokalni IP** (za testiranje)

### Korak 1.3: Kreiraj Email Nalog

1. Otvori **MailPlus Server**
2. Idi u **Users** → **Create**
3. Unesi:
   - **Email**: `claims@mrgroup` (ili tvoj domen)
   - **Password**: jaka lozinka
   - **Mailbox quota**: po potrebi (npr. 10GB)
4. Klikni **Create**

### Korak 1.4: Konfiguriši IMAP/SMTP Portove

1. U **MailPlus Server** → **Settings** → **SMTP**
2. Proveri da su portovi:
   - **IMAP**: 993 (TLS/SSL)
   - **SMTP**: 465 (TLS/SSL) ili 587 (STARTTLS)
3. Omogući **TLS/SSL** za oba

### Korak 1.5: Firewall Podešavanja

1. Idi u **Control Panel** → **Security** → **Firewall**
2. Dodaj pravila za:
   - **Port 993** (IMAP) - dozvoli pristup
   - **Port 465** (SMTP) - dozvoli pristup
   - **Port 587** (SMTP STARTTLS) - dozvoli pristup (ako koristiš)

### Korak 1.6: Testiraj Email Konfiguraciju

Možeš testirati preko email klijenta (Outlook, Thunderbird) ili direktno u aplikaciji.

## 📁 Faza 2: Setup WebDAV Server

### Korak 2.1: Instaliraj WebDAV Server

1. Otvori **Package Center**
2. Pronađi **WebDAV Server**
3. Klikni **Install**
4. Sačekaj da se instalacija završi

### Korak 2.2: Konfiguriši WebDAV Server

1. Otvori **WebDAV Server**
2. Idi u **Settings**
3. Omogući:
   - **HTTP WebDAV** (port 5005) - opciono, za lokalnu mrežu
   - **HTTPS WebDAV** (port 5006) - **PREPORUČENO** za produkciju
4. Klikni **Apply**

### Korak 2.3: Kreiraj Korisnika za WebDAV

1. Idi u **Control Panel** → **User** → **Create**
2. Kreiraj novog korisnika (npr. `webdav-user`) ili koristi postojećeg
3. Dodeli dozvole:
   - **Read/Write** pristup folderu gde će se čuvati fajlovi
   - Preporučeno: kreiraj folder `/mr-engines-warranty` u `home` direktorijumu

### Korak 2.4: Kreiraj Folder za Storage

**Možeš kreirati folder bilo gde na Synology-u!** Evo nekoliko opcija:

#### Opcija A: U Home Direktorijumu (Preporučeno za početak)
1. Otvori **File Station**
2. Idi u `/home` folder
3. Kreiraj folder: `mr-engines-warranty`
4. **WebDAV Base Path:** `/home/mr-engines-warranty`

#### Opcija B: U Shared Folder-u
1. Otvori **File Station**
2. Idi u `/volume1` (ili tvoj glavni volume)
3. Kreiraj folder: `mr-engines-warranty` (ili bilo koje ime)
4. **WebDAV Base Path:** `/volume1/mr-engines-warranty`

#### Opcija C: U Custom Volume-u
1. Otvori **File Station**
2. Idi u tvoj custom volume (npr. `/volume2`, `/volume3`)
3. Kreiraj folder: `warranty-files` (ili bilo koje ime)
4. **WebDAV Base Path:** `/volume2/warranty-files` (prilagodi prema tvom volume-u)

#### Opcija D: U Dediciranom Shared Folder-u
1. Idi u **Control Panel** → **Shared Folder** → **Create**
2. Ime: `mr-engines-warranty` (ili bilo koje ime)
3. Lokacija: izaberi volume
4. **WebDAV Base Path:** `/mr-engines-warranty` (bez volume prefix-a)

**Nakon kreiranja foldera:**
1. Desni klik na folder → **Properties** → **Permissions**
2. Dodaj WebDAV korisnika
3. Dodeli **Read/Write** dozvole
4. Klikni **Apply**

### Korak 2.5: Firewall Podešavanja

1. Idi u **Control Panel** → **Security** → **Firewall**
2. Dodaj pravilo za:
   - **Port 5006** (HTTPS WebDAV) - dozvoli pristup

### Korak 2.6: Testiraj WebDAV Pristup

Možeš testirati preko:
- **File Station** → **Tools** → **Mount Remote Drive** → **WebDAV**
- Ili direktno u aplikaciji nakon konfiguracije

## 🔐 Faza 3: Konfiguriši Aplikaciju na Vercel-u

### Korak 3.1: Dodaj Environment Varijable

U **Vercel Dashboard** → **Settings** → **Environment Variables**, dodaj:

#### Email Konfiguracija (Synology MailPlus)
```bash
IMAP_SERVER=your-synology-ip-or-domain
IMAP_PORT=993
IMAP_USER_EMAIL=claims@mrgroup
IMAP_USER_PASS=your-email-password
IMAP_TLS=true

SMTP_SERVER=your-synology-ip-or-domain
SMTP_PORT=465
SMTP_USER_EMAIL=claims@mrgroup
SMTP_USER_PASS=your-email-password
SMTP_TLS=true
```

#### WebDAV Storage Konfiguracija
```bash
WEBDAV_URL=https://your-synology-ip-or-domain:5006/webdav
WEBDAV_USERNAME=webdav-user
WEBDAV_PASSWORD=your-webdav-password
WEBDAV_BASE_PATH=/home/mr-engines-warranty
```

**Važno:** `WEBDAV_BASE_PATH` mora da odgovara **tačnoj putanji** foldera koji si kreirao na Synology-u!

**Primeri:**
- Ako si kreirao folder u `/home/mr-engines-warranty` → `WEBDAV_BASE_PATH=/home/mr-engines-warranty`
- Ako si kreirao folder u `/volume1/warranty-files` → `WEBDAV_BASE_PATH=/volume1/warranty-files`
- Ako si kreirao shared folder `mr-engines-warranty` → `WEBDAV_BASE_PATH=/mr-engines-warranty`

**Kako da proveriš tačnu putanju:**
1. Otvori **File Station**
2. Desni klik na folder → **Properties**
3. Pogledaj **Location** - to je putanja koju treba da koristiš

**Napomena:** 
- Zameni `your-synology-ip-or-domain` sa:
  - Tvojim QuickConnect ID (npr. `yourname.synology.me`)
  - DDNS domenom (ako imaš)
  - Ili javnom IP adresom (ako je statična)

### Korak 3.2: Redeploy Aplikaciju

1. U Vercel dashboard-u, klikni **Deployments**
2. Klikni **Redeploy** na poslednjem deployment-u
3. Sačekaj da se završi

## ✅ Faza 4: Testiranje

### Test 1: Email Sync

1. Pošalji test email na `claims@mrgroup`
2. Idi u aplikaciju → **Inbox**
3. Proveri da li se email pojavio
4. Proveri da li su attachmenti sačuvani

### Test 2: File Storage

1. Otvori claim sa attachmentom
2. Proveri da li se fajl učitava
3. Proveri u **File Station** da li se fajl nalazi u `/home/mr-engines-warranty`

## 🐳 Faza 3: Container Manager (Opciono)

**Napomena:** Container Manager **NIJE neophodan** za osnovnu funkcionalnost aplikacije. Aplikacija već radi na Vercel-u i koristi Synology samo za email i storage.

Container Manager bi bio koristan ako želiš:

### Scenario 1: Pokretanje Aplikacije na Synology-u (umesto Vercel-a)

Ako želiš da pokreneš aplikaciju direktno na Synology-u umesto na Vercel-u:

1. **Instaliraj Container Manager:**
   - Package Center → **Container Manager** → Install

2. **Kreiraj Docker Container:**
   - Koristi Node.js image
   - Mount-uj volume za storage
   - Konfiguriši environment varijable
   - Eksponuj port 3000

3. **Prednosti:**
   - Potpuna kontrola nad aplikacijom
   - Nema Vercel ograničenja
   - Sve na jednom mestu (NAS)

4. **Mane:**
   - Kompleksniji setup
   - Trebaš da održavaš Node.js, bazu podataka, itd.
   - Manje skalabilno od Vercel-a

### Scenario 2: Dodatni Servisi

Container Manager može biti koristan za:
- **Redis** - za caching ili queue sistem
- **PostgreSQL** - ako želiš da migriraš sa Turso/SQLite
- **Background Workers** - za dugotrajne zadatke
- **Monitoring Tools** - za praćenje performansi

### Scenario 3: Development/Testing

Možeš koristiti Container Manager za:
- Lokalno testiranje aplikacije
- Development okruženje
- Testiranje integracija sa Synology servisima

### Kada Container Manager NIJE potreban:

✅ **Trenutna arhitektura (Vercel + Synology):**
- Aplikacija radi na Vercel-u
- Email server na Synology-u (MailPlus)
- Storage na Synology-u (WebDAV)
- **Container Manager NIJE potreban**

### Kada bi Container Manager bio koristan:

✅ **Alternativna arhitektura (Sve na Synology-u):**
- Aplikacija na Synology-u (Docker)
- Email server na Synology-u (MailPlus)
- Storage na Synology-u (WebDAV)
- Baza podataka na Synology-u (PostgreSQL u Docker-u)
- **Container Manager JE potreban**

---

**Preporuka:** Za početak, **NE instaliraj Container Manager** osim ako ne planiraš da pokreneš aplikaciju direktno na Synology-u ili ti trebaju dodatni servisi.

## 🔒 Bezbednosne Preporuke

1. **Koristi HTTPS** za WebDAV (port 5006)
2. **Jake lozinke** za email i WebDAV korisnike
3. **Firewall pravila** - dozvoli samo potrebne portove
4. **VPN pristup** - razmotri VPN za dodatnu bezbednost
5. **Regularni backup** - koristi Hyper Backup za backup podataka

## 🐛 Troubleshooting

### Problem: Email sync ne radi

**Rešenje:**
1. Proveri da li su portovi 993 i 465 otvoreni u firewall-u
2. Proveri da li je IMAP/SMTP omogućen u MailPlus Server
3. Proveri credentials u Vercel environment varijablama
4. Proveri logove u aplikaciji

### Problem: WebDAV upload ne radi

**Rešenje:**
1. Proveri da li je port 5006 otvoren u firewall-u
2. Proveri WebDAV credentials u Vercel environment varijablama
3. Proveri da li korisnik ima Read/Write dozvole
4. Proveri da li folder `/mr-engines-warranty` postoji
5. Proveri logove u aplikaciji

### Problem: Spor pristup fajlovima

**Rešenje:**
1. Proveri mrežnu vezu između Vercel-a i Synology-a
2. Razmotri korišćenje VPN-a za bolju performansu
3. Proveri da li koristiš HTTPS (može biti sporiji od HTTP)

## 📊 Storage Prioritet

Aplikacija koristi sledeći prioritet za storage:

1. **WebDAV** (ako su `WEBDAV_URL`, `WEBDAV_USERNAME`, `WEBDAV_PASSWORD` postavljeni)
2. **Vercel Blob** (ako je `BLOB_READ_WRITE_TOKEN` postavljen)
3. **Filesystem** (fallback, ne preporučeno za produkciju)

## 🔄 Migracija sa Vercel Blob na WebDAV

Ako već koristiš Vercel Blob i želiš da migriraš na WebDAV:

1. **Postavi WebDAV environment varijable** (kao što je opisano gore)
2. **Redeploy aplikaciju**
3. Novi fajlovi će se automatski čuvati na WebDAV
4. Stari fajlovi će ostati na Vercel Blob (neće se automatski migrirati)

## 📞 Podrška

Ako imaš problema, proveri:
- Synology logove: **Control Panel** → **Info Center** → **Logs**
- Aplikacija logove: Vercel Dashboard → **Functions** → **Logs**

---

**Napomena:** Ovaj setup zahteva da tvoj Synology NAS bude dostupan sa interneta (preko QuickConnect, DDNS, ili javne IP adrese).
