# WebDAV QuickConnect Problem - Rešenje

## Problem

QuickConnect link ne radi sa Vercel-a jer Vercel serverless funkcije ne mogu da pristupe QuickConnect linkovima.

**Greška:**
```
ETIMEDOUT 192.168.100.226:5006
```

**Uzrok:** QuickConnect linkovi (`*.direct.quickconnect.to`) su namenjeni za pristup preko browser-a, ne za server-to-server komunikaciju.

## Rešenja

### ✅ Opcija 1: Koristi DynDNS ili Direktan Domain (PREPORUČENO)

Ako imaš DynDNS ili direktan domain za Synology:

**1. Setup DynDNS na Synology-u:**
   - Control Panel → External Access → DDNS
   - Dodaj DDNS provajdera (npr. No-IP, DuckDNS)
   - Dodeli domain (npr. `your-synology.ddns.net`)

**2. Update Vercel Environment Variables:**
   ```bash
   WEBDAV_URL=https://your-synology.ddns.net:5006
   ```

**Prednosti:**
- ✅ Radi sa Vercel serverless funkcijama
- ✅ Stabilniji pristup
- ✅ Mogućnost korišćenja validnih SSL sertifikata

---

### ✅ Opcija 2: Koristi Cloudflare Tunnel (ALTERNATIVA)

Ako nemaš DynDNS, možeš koristiti Cloudflare Tunnel:

**1. Instaliraj cloudflared na Synology-u (preko Docker-a)**

**2. Kreiraj tunnel:**
   ```bash
   cloudflared tunnel create webdav-tunnel
   ```

**3. Configure tunnel:**
   ```yaml
   tunnel: webdav-tunnel
   credentials-file: /path/to/credentials.json
   
   ingress:
     - hostname: webdav.yourdomain.com
       service: https://localhost:5006
     - service: http_status:404
   ```

**4. Update Vercel Environment Variables:**
   ```bash
   WEBDAV_URL=https://webdav.yourdomain.com
   ```

---

### ✅ Opcija 3: Koristi Vercel Blob umesto WebDAV (NAJJEDNOSTAVNIJE)

Ako ne možeš da postaviš direktan pristup, možeš koristiti Vercel Blob:

**1. Kreiraj Vercel Blob store:**
   - Vercel Dashboard → Storage → Create Store
   - Copy token

**2. Update Vercel Environment Variables:**
   ```bash
   # Remove WebDAV vars
   # Add Blob token
   BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxx
   ```

**Prednosti:**
- ✅ Radi odmah
- ✅ Ne treba firewall konfiguracija
- ✅ Brže performanse

**Nedostaci:**
- ❌ Trošak (Vercel Blob je plaćen servis)
- ❌ Fajlovi nisu na tvom Synology-u

---

### ⚠️ Opcija 4: Koristi Tailscale (AKO VEĆ IMAŠ)

Ako već imaš Tailscale na Synology-u i Droplet-u:

**1. Koristi Tailscale IP umesto QuickConnect:**
   ```bash
   WEBDAV_URL=https://100.80.235.71:5006
   ```

**Problem:** Vercel ne može da pristupi Tailscale VPN-u direktno.

**Rešenje:** Koristi DigitalOcean Droplet kao reverse proxy (ali ovo smo već preskočili).

---

## Preporučeno Rešenje

**Najbolje je da koristiš Opciju 1 (DynDNS)** jer:
- ✅ Najstabilnije
- ✅ Besplatno
- ✅ Radi direktno sa Vercel-a
- ✅ Fajlovi ostaju na tvom Synology-u

## Koraci za DynDNS Setup

1. **Registruj se na DynDNS provajderu:**
   - [No-IP](https://www.noip.com) (besplatno)
   - [DuckDNS](https://www.duckdns.org) (besplatno)
   - Ili bilo koji drugi DDNS provajder

2. **Setup DDNS na Synology-u:**
   - Control Panel → External Access → DDNS
   - Klikni "Add"
   - Izaberi provajdera
   - Unesi domain i credentials
   - Klikni "OK"

3. **Proveri da li radi:**
   - Otvori browser: `https://your-dynns-domain.ddns.net:5006`
   - Trebalo bi da se poveže na Synology

4. **Update Vercel Environment Variables:**
   ```bash
   WEBDAV_URL=https://your-dynns-domain.ddns.net:5006
   ```

5. **Redeploy aplikaciju**

6. **Testiraj:**
   - Otvori: `https://your-app.vercel.app/api/debug/webdav-test`
   - Trebalo bi da vidiš `"success": true`
