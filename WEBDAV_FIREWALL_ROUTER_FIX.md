# WebDAV Connection Problem - Firewall i Router Fix

## Problem

Svi DDNS provajderi (DuckDNS, FreeDNS) vraćaju `ERR_CONNECTION_REFUSED` grešku.

**Uzrok:** Problem nije u DDNS-u, već u pristupu portu 5006 sa interneta.

## Provera Korak po Korak

### Korak 1: Proveri WebDAV Server Status (NAJVAŽNIJE!)

1. **Synology DSM → Package Center**
2. Pronađi **"WebDAV Server"**
3. Proveri da li je status: **"Running"** (zeleno)
4. Ako nije, klikni **"Open"** ili **"Start"**

### Korak 2: Proveri WebDAV Settings

1. Otvori **WebDAV Server** aplikaciju
2. Idi u **Settings** tab
3. Proveri:
   - ☑ **"Enable HTTPS"** je označeno ✓
   - Port je **5006** ✓
   - Klikni **"Apply"** ako si nešto promenio

### Korak 3: Proveri Firewall na Synology-u (KRITIČNO!)

1. **Control Panel → Security → Firewall**
2. Proveri da li je firewall **omogućen**

**Ako je firewall omogućen:**
1. Klikni **"Firewall Profile"** → **"Edit Rules"**
2. Proveri da li postoji pravilo za port **5006**

**Ako NE postoji pravilo za port 5006:**
1. Klikni **"Create"**
2. Popuni:
   - **Action:** Allow
   - **Protocol:** TCP
   - **Port:** `5006`
   - **Source IP:** All (ili ostavi prazno)
   - **Destination IP:** All (ili ostavi prazno)
3. Klikni **"OK"**
4. Klikni **"Apply"**

**VAŽNO:** Firewall pravilo mora postojati ako je firewall omogućen!

### Korak 4: Proveri Router Port Forwarding

**Ako nemaš pristup router-u:**
- Skip ovaj korak - problem je verovatno u firewall-u ili WebDAV serveru

**Ako imaš pristup router-u:**
1. Idi u router settings (obično `192.168.1.1` ili `192.168.0.1`)
2. Proveri da li postoji **Port Forwarding** pravilo za port **5006**
3. Ako ne postoji, dodaj:
   - **External Port:** `5006`
   - **Internal IP:** `192.168.100.226` (Synology IP)
   - **Internal Port:** `5006`
   - **Protocol:** TCP
   - **Save**

### Korak 5: Test WebDAV Server Status

**Možda možeš testirati iako nisi lokalno:**

1. Otvori **WebDAV Server** aplikaciju na Synology-u
2. Proveri da li postoji **"Status"** ili **"Logs"** tab
3. Proveri da li se vidi aktivnost ili greške

## Alternativa: Koristi QuickConnect za WebDAV (Ako Router Blokira)

Ako router port forwarding ne možeš da rešiš, možda možeš koristiti QuickConnect:

### Setup QuickConnect WebDAV:

1. **Control Panel → External Access → QuickConnect**
2. Proveri da li je QuickConnect omogućen
3. Proveri da li postoji QuickConnect URL (npr. `xxx.quickconnect.to`)

**Problem:** QuickConnect možda ne podržava WebDAV direktno, ali možda postoji način.

## Alternativa: Koristi Vercel Blob (Trenutno Rešenje)

Ako ne možeš da rešiš port forwarding/firewall problem, možda je najbolje koristiti Vercel Blob privremeno:

1. **Vercel Dashboard → Storage → Create Store**
2. Copy token
3. U Vercel Environment Variables:
   - Obriši `WEBDAV_URL`, `WEBDAV_USERNAME`, `WEBDAV_PASSWORD`
   - Dodaj: `BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxx`
4. Redeploy

**Napomena:** Fajlovi neće biti na Synology-u, ali će attachmente raditi.

## Checklist Pre Provere

**Proveri redom:**
1. [ ] WebDAV Server status: "Running"?
2. [ ] WebDAV Server Settings: "Enable HTTPS" označeno?
3. [ ] Firewall status: omogućen ili onemogućen?
4. [ ] Firewall pravilo za port 5006: postoji?
5. [ ] Router port forwarding: postoji? (ako imaš pristup)

**Javi rezultate:**
- Da li je WebDAV Server "Running"?
- Da li je firewall omogućen?
- Da li postoji firewall pravilo za port 5006?
- Da li imaš pristup router-u da proveriš port forwarding?

Na osnovu toga ćemo videti gde je tačno problem!
