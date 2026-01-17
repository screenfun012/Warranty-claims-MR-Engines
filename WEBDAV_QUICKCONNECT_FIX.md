# WebDAV QuickConnect Fix

## Problem sa QuickConnect Linkom

Ako koristiš QuickConnect link za WebDAV, postoji nekoliko problema:

1. **SSL sertifikati:** QuickConnect linkovi koriste self-signed sertifikate koji mogu da prave probleme
2. **Dinamički linkovi:** QuickConnect linkovi su dinamički i mogu da se menjaju
3. **Format URL-a:** URL ne sme da ima `/webdav` na kraju

## Pravilna Konfiguracija

### Opcija 1: Koristi QuickConnect (ako nemaš drugu opciju)

**Vercel Environment Variables:**

```bash
# WebDAV URL - BEZ /webdav na kraju!
WEBDAV_URL=https://192-168-100-226.mrengines.direct.quickconnect.to:5006

# WebDAV korisničko ime
WEBDAV_USERNAME=webdav-user

# WebDAV lozinka
WEBDAV_PASSWORD=your-password

# Base path - gde će se fajlovi čuvati
WEBDAV_BASE_PATH=/Warranty/REKLAMACIJE
# ILI
WEBDAV_BASE_PATH=/volume10/Warranty/REKLAMACIJE
```

**VAŽNO:**
- ❌ **POGREŠNO:** `https://...quickconnect.to:5006/webdav` (sa `/webdav`)
- ✅ **TAČNO:** `https://...quickconnect.to:5006` (bez `/webdav`)

### Opcija 2: Koristi Direktan Domain ili DynDNS (preporučeno)

Ako imaš DynDNS ili direktan domain za Synology:

```bash
# WebDAV URL - direktan pristup
WEBDAV_URL=https://your-synology.dyndns.org:5006
# ILI
WEBDAV_URL=https://mail.mrgroup.rs:5006
```

**Prednosti:**
- ✅ Stabilniji pristup
- ✅ Mogućnost korišćenja validnih SSL sertifikata
- ✅ Bolje performanse

## Provera Konfiguracije

Nakon što postaviš environment varijable:

1. **Redeploy aplikaciju na Vercel-u:**
   - Idi u Vercel Dashboard → Deployments
   - Klikni na tri tačke (⋯) → Redeploy

2. **Proveri da li WebDAV radi:**
   - Otvori: `https://your-app.vercel.app/api/debug/storage`
   - Trebalo bi da vidiš: `"webdav": { "enabled": true, ... }`

3. **Proveri Vercel Logs:**
   - Idi u Vercel Dashboard → Deployments → Runtime Logs
   - Traži `[FileStorage]` poruke
   - Trebalo bi da vidiš: `[FileStorage] ✓ WebDAV client initialized successfully`

## Troubleshooting

### Problem: "WebDAV client not initialized"

**Uzrok:** Environment varijable nisu postavljene ili su pogrešno formatirane.

**Rešenje:**
1. Proveri da li su sve varijable postavljene u Vercel Dashboard-u
2. Proveri da li `WEBDAV_URL` NEMA `/webdav` na kraju
3. Redeploy aplikaciju

### Problem: "Failed to connect to WebDAV"

**Uzrok:** 
- QuickConnect link ne radi pravilno
- Firewall blokira port 5006
- WebDAV server nije omogućen

**Rešenje:**
1. Proveri da li WebDAV server radi na Synology-u:
   - Control Panel → File Services → WebDAV
   - Proveri da li je HTTPS WebDAV omogućen
   - Proveri da li je port 5006 otvoren

2. Proveri firewall:
   - Control Panel → Security → Firewall
   - Proveri da li je port 5006 dozvoljen

3. Proveri da li QuickConnect radi:
   - Control Panel → External Access → QuickConnect
   - Proveri da li je QuickConnect aktiviran

### Problem: "Certificate error" ili "SSL error"

**Uzrok:** QuickConnect koristi self-signed sertifikate.

**Rešenje:**
- WebDAV client bi trebalo da automatski ignoriše self-signed sertifikate
- Ako i dalje ne radi, proveri da li je `WEBDAV_URL` pravilno formatiran

## Provera na Synology-u

1. **Proveri WebDAV server:**
   - Control Panel → File Services → WebDAV
   - Proveri da li je "Enable WebDAV service" označeno
   - Proveri da li je "Enable HTTPS WebDAV service" označeno
   - Port bi trebalo da bude 5006

2. **Proveri korisničke dozvole:**
   - Control Panel → User & Group → webdav-user
   - Proveri da li korisnik ima dozvole za `/Warranty/REKLAMACIJE` folder

3. **Proveri folder permisije:**
   - File Station → `/Warranty/REKLAMACIJE`
   - Proveri da li WebDAV korisnik ima Read/Write dozvole
