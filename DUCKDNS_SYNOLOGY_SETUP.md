# DuckDNS Setup na Synology-u - Korak po Korak

## Tvoji Podaci

- **Domain:** `mr-engines.duckdns.org`
- **Token:** `7b096e06-4f78-417c-bd07-cb109122f67a`
- **Current IP:** `79.101.226.96`

## Korak po Korak Setup na Synology-u

### Korak 1: Otvori DDNS Settings

1. Idi u **Synology DSM**
2. **Control Panel** → **External Access** → **DDNS** tab
3. Klikni **"Add"** (ili **"Create"** ako ne vidiš Add dugme)

### Korak 2: Konfiguriši DuckDNS

**Service Provider:**
- Izaberi **"DuckDNS"** iz dropdown-a (ako ne vidiš DuckDNS, izaberi **"Custom"** ili **"User-defined"**)

**Hostname:**
- Unesi: `mr-engines.duckdns.org`

**Username / Email:**
- Unesi: `mr-engines` (tvoj subdomain)

**Password / Token:**
- Unesi: `7b096e06-4f78-417c-bd07-cb109122f67a` (tvoj token)

**External Address (IPv4):**
- Ostavi **PRAZNO** (automatski će se ažurirati)

**Update Period:**
- Možeš ostaviti default ili podesiti na 5 minuta

### Korak 3: Sačuvaj

1. Klikni **"OK"** ili **"Apply"**
2. Sačekaj nekoliko sekundi
3. Trebalo bi da vidiš:
   - ✅ Zeleni check mark pored DuckDNS entry-ja
   - Status: **"Normal"** ili **"Success"**
   - External Address: `79.101.226.96` (tvoja IP adresa)

### Korak 4: Proveri da li Radi

**Test 1: Browser Test**
1. Otvori browser
2. Idi na: `https://mr-engines.duckdns.org:5006`
3. Trebalo bi da:
   - Poveže se na Synology (može potrajati 10-30 sekundi)
   - Traži korisničko ime i lozinku (WebDAV credentials)
   - Ili prikaže upozorenje o self-signed sertifikatu (to je OK)

**Test 2: Proveri DuckDNS na DuckDNS sajtu**
1. Idi na [https://www.duckdns.org](https://www.duckdns.org)
2. Login sa Google-om
3. Trebalo bi da vidiš:
   - Domain: `mr-engines.duckdns.org`
   - IP: `79.101.226.96`

## Troubleshooting

### Problem: Status "Abnormal" ili crveni X

**Uzrok:** Token ili hostname su pogrešni.

**Rešenje:**
1. Proveri da li je token tačan (copy/paste iz DuckDNS sajta)
2. Proveri da li je hostname tačan: `mr-engines.duckdns.org` (sa `.duckdns.org` na kraju)
3. Proveri da li je username tačan: `mr-engines` (bez `.duckdns.org`)

### Problem: Browser ne može da se poveže na `https://mr-engines.duckdns.org:5006`

**Uzrok:** Firewall blokira port 5006 ili WebDAV server nije omogućen.

**Rešenje:**
1. **Proveri WebDAV server:**
   - Control Panel → File Services → WebDAV
   - Proveri da li je "Enable HTTPS WebDAV service" označeno
   - Port bi trebalo da bude `5006`

2. **Proveri firewall:**
   - Control Panel → Security → Firewall
   - Proveri da li postoji pravilo za port 5006
   - Ako ne, dodaj:
     - **Action:** Allow
     - **Protocol:** TCP
     - **Port:** `5006`
     - **Source IP:** All (ili ostavi prazno)

3. **Proveri router port forwarding:**
   - Ako koristiš router, proveri da li je port 5006 forward-ovan ka Synology-u
   - Port forwarding nije obavezan ako imaš direktan pristup internetu

### Problem: DuckDNS ne ažurira IP adresu

**Uzrok:** Synology nema pristup internetu ili token je pogrešan.

**Rešenje:**
1. Proveri da li Synology ima pristup internetu
2. Proveri da li je token tačan
3. Pokušaj da manualno ažuriraš IP:
   - Otvori browser: `https://www.duckdns.org/update?domains=mr-engines&token=7b096e06-4f78-417c-bd07-cb109122f67a&ip=79.101.226.96`
   - Trebalo bi da vidiš: `OK`

## Sledeći Korak: Update Vercel

Nakon što DuckDNS radi na Synology-u:

1. **Update Vercel Environment Variables:**
   - Vercel Dashboard → Settings → Environment Variables
   - Ažuriraj `WEBDAV_URL`:
     ```
     WEBDAV_URL=https://mr-engines.duckdns.org:5006
     ```
   - **VAŽNO:** Bez `/webdav` na kraju!

2. **Redeploy aplikaciju:**
   - Vercel Dashboard → Deployments → Redeploy

3. **Testiraj:**
   - Otvori: `https://your-app.vercel.app/api/debug/webdav-test`
   - Trebalo bi da vidiš `"success": true`
