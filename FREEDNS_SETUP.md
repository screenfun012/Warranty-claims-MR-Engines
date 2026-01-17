# FreeDNS Setup - WebDAV Pristup za Vercel

## Problem

DuckDNS ne radi sa Vercel-a zbog connection refused greške. Koristimo FreeDNS umesto DuckDNS jer Synology ima FreeDNS kao built-in opciju.

## Koraci

### Korak 1: Registruj se na FreeDNS (2 minuta)

1. Idi na [https://freedns.afraid.org](https://freedns.afraid.org)
2. Klikni **"Sign up"** ili **"Register"**
3. Popuni formu:
   - Username: tvoje korisničko ime
   - Email: tvoja email adresa
   - Password: tvoja lozinka
4. Klikni **"Sign up"**
5. Proveri email i potvrdi registraciju

### Korak 2: Kreiraj Domain na FreeDNS (3 minuta)

1. Login na [https://freedns.afraid.org](https://freedns.afraid.org)
2. Idi u **"Subdomains"** ili **"My Domains"**
3. Klikni **"Add"** ili **"Create Subdomain"**
4. Popuni:
   - **Subdomain:** `mr-engines` (ili bilo koji naziv)
   - **Domain:** Izaberi neki free domain (npr. `ddns.net`, `mooo.com`, `hopto.org`)
   - **Type:** A (IPv4)
   - **Destination:** `79.101.226.96` (tvoja trenutna IP) - može ostati prazno, automatski će se ažurirati
5. Klikni **"Save"** ili **"Create"**

**Rezultat:**
- Tvoj domain: `mr-engines.ddns.net` (ili šta si izabrao)
- Domain će automatski ažurirati IP adresu

### Korak 3: Dobij Token za DDNS Update

1. U FreeDNS dashboard-u, idi na **"Dynamic DNS"** ili **"Quick cron example"**
2. Trebalo bi da vidiš URL za DDNS update:
   ```
   http://freedns.afraid.org/dynamic/update.php?YOUR_TOKEN_HERE
   ```
3. Copy **TOKEN** iz URL-a (dugački string)
4. **ILI** kopiraj ceo update URL

**Alternativa:** Možeš koristiti username/password umesto tokena.

### Korak 4: Setup FreeDNS na Synology-u (3 minuta)

1. **Synology DSM → Control Panel → External Access → DDNS**
2. Klikni **"Add"**
3. U "Add DDNS" dialog-u:

**Service Provider:**
- Izaberi **"FreeDNS"** iz dropdown-a (trebalo bi da postoji u listi!)

**Hostname:**
- Unesi: `mr-engines.ddns.net` (tvoj FreeDNS domain)

**Username/Email:**
- Unesi: tvoje FreeDNS korisničko ime

**Password/Token:**
- Unesi: tvoj FreeDNS token ILI password

**External Address (IPv4):**
- Ostavi **PRAZNO** (automatski će se ažurirati)

4. Klikni **"OK"**

**Provera:**
- Trebalo bi da vidiš zeleni check mark
- Status: **"Normal"**
- External Address: tvoja IP adresa

### Korak 5: Test u Browser-u (2 minuta)

1. Otvori: `https://mr-engines.ddns.net:5006` (koristi tvoj FreeDNS domain)
2. Trebalo bi da:
   - Poveže se na Synology (može potrajati 10-30 sekundi)
   - Traži korisničko ime i lozinku (WebDAV credentials)
   - Ili prikaže upozorenje o self-signed sertifikatu (to je OK)

**Napomena:** Možda treba sačekati 2-5 minuta da se DNS propagira.

### Korak 6: Update Vercel Environment Variables (2 minuta)

1. **Vercel Dashboard → Settings → Environment Variables**
2. Ažuriraj `WEBDAV_URL`:
   ```
   WEBDAV_URL=https://mr-engines.ddns.net:5006
   ```
   (Koristi tvoj FreeDNS domain)

3. Proveri da su i ostale varijable postavljene:
   - `WEBDAV_USERNAME`
   - `WEBDAV_PASSWORD`
   - `WEBDAV_BASE_PATH`

### Korak 7: Redeploy Aplikaciju (2 minuta)

1. **Vercel Dashboard → Deployments → Redeploy**
2. Sačekaj da se završi (2-5 minuta)

### Korak 8: Test WebDAV Connection

1. Otvori: `https://your-app.vercel.app/api/debug/webdav-test`
2. Trebalo bi da vidiš:
   ```json
   {
     "success": true,
     "message": "WebDAV connection successful!",
     "details": {
       "basePathExists": true,
       "testWriteRead": "successful"
     }
   }
   ```

## Prednosti FreeDNS

- ✅ Built-in podrška na Synology-u
- ✅ Besplatno
- ✅ Stabilno
- ✅ Automatsko ažuriranje IP adrese
- ✅ Radi sa Vercel serverless funkcijama

## Troubleshooting

### Problem: FreeDNS nije u listi Service Provider-a

**Rešenje:**
- Proveri da li je tvoja Synology verzija podržana
- Možda treba da koristiš "Custom" provider (kao sa DuckDNS)

### Problem: "Connection refused" greška

**Uzrok:** Isti kao sa DuckDNS - firewall ili router.

**Rešenje:**
- Proveri firewall na Synology-u (port 5006)
- Proveri router port forwarding
- Proveri da li WebDAV server radi

### Problem: FreeDNS ne ažurira IP adresu

**Rešenje:**
- Proveri da li je token/password tačan
- Proveri da li Synology ima pristup internetu
- Manualno ažuriraj IP ako treba

## Checklist

- [ ] FreeDNS account kreiran
- [ ] Domain kreiran na FreeDNS-u
- [ ] Token/password dobijen
- [ ] FreeDNS konfigurisan na Synology-u
- [ ] FreeDNS status "Normal" na Synology-u
- [ ] Test u browser-u: `https://mr-engines.ddns.net:5006` radi
- [ ] Vercel `WEBDAV_URL` ažuriran
- [ ] Aplikacija redeploy-ovana
- [ ] `/api/debug/webdav-test` vraća `"success": true`
