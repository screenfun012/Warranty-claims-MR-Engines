# DuckDNS Setup - WebDAV Pristup za Vercel

## Problem

QuickConnect linkovi ne rade sa Vercel serverless funkcijama jer su namenjeni za browser pristup, ne za server-to-server komunikaciju.

**Rešenje:** Koristi DuckDNS za direktan pristup Synology WebDAV serveru.

## Koraci

### Korak 1: Registruj se na DuckDNS (2 minuta)

1. Idi na [https://www.duckdns.org](https://www.duckdns.org)
2. Klikni **"Sign in with Google"** (ili bilo koji drugi način)
3. Prihvati uslove
4. Login sa Google nalogom

### Korak 2: Kreiraj Domain (1 minut)

1. Nakon logina, vidićeš **"What subdomain?"** polje
2. Unesi željeni subdomain (npr. `mr-engines` ili `mr-engines-warranty`)
3. Klikni **"Add domain"**
4. Copy **Token** koji se pojavi (trebaće ti za Synology)

**Rezultat:**
- Tvoj domain: `mr-engines.duckdns.org` (ili šta si uneo)
- Token: `xxxx-xxxx-xxxx-xxxx-xxxx`

### Korak 3: Setup DuckDNS na Synology-u (5 minuta)

1. Otvori Synology DSM
2. Idi u **Control Panel** → **External Access** → **DDNS**
3. Klikni **"Add"**
4. Izaberi **"DuckDNS"** iz Service Provider dropdown-a
5. Popuni:
   - **Service provider:** DuckDNS
   - **Hostname:** `mr-engines.duckdns.org` (tvoj DuckDNS domain)
   - **Username/Email:** `mr-engines` (tvoj subdomain)
   - **Password/Token:** `<tvoj-token-sa-DuckDNS>` (token koji si copy-ovao)
   - **External Address (IPv4):** Ostavi prazno (automatski se ažurira)
6. Klikni **"OK"**

**Provera:**
- Trebalo bi da vidiš zeleni check mark pored DuckDNS entry-ja
- Status treba da bude "Normal"

### Korak 4: Proveri da li Radi (1 minut)

1. Otvori browser
2. Idi na: `https://mr-engines.duckdns.org:5006` (koristi tvoj domain)
3. Trebalo bi da se poveže na Synology WebDAV server
4. Trebalo bi da traži korisničko ime i lozinku (WebDAV credentials)

**Napomena:** Browser može da prikaže upozorenje o self-signed sertifikatu - to je OK.

### Korak 5: Update Vercel Environment Variables (2 minuta)

1. Otvori **Vercel Dashboard** → **Settings** → **Environment Variables**
2. Ažuriraj `WEBDAV_URL`:
   ```bash
   WEBDAV_URL=https://mr-engines.duckdns.org:5006
   ```
   **VAŽNO:** 
   - Bez `/webdav` na kraju!
   - Koristi HTTPS (https://)
   - Koristi port 5006

3. Proveri da su i ostale varijable postavljene:
   ```bash
   WEBDAV_USERNAME=webdav-user
   WEBDAV_PASSWORD=your-password
   WEBDAV_BASE_PATH=/volume10/Warranty/REKLAMACIJE
   ```

### Korak 6: Redeploy Aplikaciju (2 minuta)

1. Vercel Dashboard → **Deployments**
2. Klikni na tri tačke (⋯) na poslednjem deployment-u
3. Klikni **"Redeploy"**
4. Sačekaj da se završi (2-5 minuta)

### Korak 7: Testiraj (1 minut)

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

## Troubleshooting

### Problem: "ETIMEDOUT" ili "Connection timeout"

**Uzrok:** Firewall blokira port 5006 ili DuckDNS ne radi.

**Rešenje:**
1. Proveri da li DuckDNS radi:
   - Control Panel → External Access → DDNS
   - Trebalo bi da vidiš "Normal" status
   
2. Proveri firewall:
   - Control Panel → Security → Firewall
   - Proveri da li je port 5006 dozvoljen
   - Dodaj pravilo ako treba:
     - Port: `5006`
     - Protocol: `TCP`
     - Action: `Allow`

3. Proveri WebDAV server:
   - Control Panel → File Services → WebDAV
   - Proveri da li je "Enable HTTPS WebDAV service" označeno
   - Port bi trebalo da bude 5006

### Problem: "SSL Error" ili "Certificate Error"

**Uzrok:** Synology koristi self-signed sertifikat.

**Rešenje:**
- WebDAV client bi automatski trebalo da ignoriše self-signed sertifikate
- Ako i dalje ne radi, proveri da li `WEBDAV_URL` koristi HTTPS (ne HTTP)

### Problem: DuckDNS Status "Abnormal"

**Uzrok:** DuckDNS ne može da ažurira IP adresu.

**Rešenje:**
1. Proveri da li je token tačan u Synology DDNS konfiguraciji
2. Proveri da li Synology ima pristup internetu
3. Pokušaj da manualno ažuriraš IP:
   - Idi na [https://www.duckdns.org](https://www.duckdns.org)
   - Klikni na tvoj domain
   - Klikni "Update IP"

## Prednosti DuckDNS

- ✅ Besplatno
- ✅ Jednostavno za setup
- ✅ Radi direktno sa Vercel-a
- ✅ Automatski ažurira IP adresu
- ✅ Stabilno rešenje

## Final Checklist

- [ ] DuckDNS account kreiran
- [ ] Domain kreiran na DuckDNS-u
- [ ] Token copy-ovan
- [ ] DDNS konfigurisan na Synology-u
- [ ] DuckDNS status "Normal" na Synology-u
- [ ] Test u browser-u: `https://mr-engines.duckdns.org:5006` radi
- [ ] Vercel `WEBDAV_URL` ažuriran
- [ ] Aplikacija redeploy-ovana
- [ ] `/api/debug/webdav-test` vraća `"success": true`
