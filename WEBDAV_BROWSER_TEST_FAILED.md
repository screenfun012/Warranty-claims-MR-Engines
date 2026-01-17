# WebDAV Browser Test Failed - Troubleshooting

## Problem

Browser ne može da se poveže na `https://mr-engines.duckdns.org:5006`

**Greška:**
```
Safari Can't Connect to the Server
Safari can't connect to the server 'mr-engines.duckdns.org'
```

## Mogući Uzroci

### 1. Firewall Blokira Port 5006

**Provera:**
1. **Synology DSM → Control Panel → Security → Firewall**
2. Proveri da li postoji pravilo za port 5006
3. Ako ne postoji, dodaj pravilo:
   - **Action:** Allow
   - **Protocol:** TCP
   - **Port:** `5006`
   - **Source IP:** All (ili ostavi prazno)

**Dodavanje Firewall Pravila:**
1. Control Panel → Security → Firewall → Firewall Profile → Edit Rules
2. Klikni "Create"
3. Popuni:
   - **Action:** Allow
   - **Protocol:** TCP
   - **Port:** `5006`
   - **Source IP:** All
   - **Destination IP:** All
4. Klikni "OK"
5. Klikni "Apply"

### 2. WebDAV Server Nije Omogućen

**Provera:**
1. **Synology DSM → Control Panel → File Services → WebDAV**
2. Proveri da li je **"Enable WebDAV service"** označeno
3. Proveri da li je **"Enable HTTPS WebDAV service"** označeno
4. Proveri da li je port `5006` postavljen za HTTPS

**Ako nije omogućen:**
1. Označi **"Enable WebDAV service"**
2. Označi **"Enable HTTPS WebDAV service"**
3. Postavi port na `5006`
4. Klikni **"Apply"**

### 3. Router Port Forwarding

**Provera:**
1. Proveri da li router forwarduje port 5006 ka Synology-u
2. Ako nema port forwarding, dodaj:
   - **External Port:** `5006`
   - **Internal IP:** Synology IP adresa (npr. `192.168.100.226`)
   - **Internal Port:** `5006`
   - **Protocol:** TCP

**Napomena:** Ako nemaš pristup router-u, možda treba da koristiš QuickConnect ili drugi način pristupa.

### 4. DuckDNS IP Ažuriranje

**Provera:**
1. Idi na [https://www.duckdns.org](https://www.duckdns.org)
2. Login sa Google-om
3. Proveri da li je IP adresa tačna:
   - **Current IP:** Trebalo bi da bude `79.101.226.96` (tvoja javna IP)
   - Ako nije tačna, klikni **"Update IP"**

**Manual Update:**
Ako DuckDNS nije ažuriran, otvori u browser-u:
```
https://www.duckdns.org/update?domains=mr-engines&token=7b096e06-4f78-417c-bd07-cb109122f67a&ip=79.101.226.96
```

Trebalo bi da vidiš: `OK`

### 5. Provera da li WebDAV Radi Lokalno

**Test sa Synology-a:**
1. SSH na Synology (ako imaš pristup)
2. Testiraj:
   ```bash
   curl -k https://localhost:5006
   ```
   Trebalo bi da vidiš WebDAV response

**Test sa lokalne mreže:**
1. Proveri Synology lokalnu IP adresu (npr. `192.168.100.226`)
2. Otvori u browser-u: `https://192.168.100.226:5006`
3. Trebalo bi da se poveže (može potrajati 10-30 sekundi)

### 6. Provera DuckDNS DNS Propagacije

**Test DNS:**
```bash
nslookup mr-engines.duckdns.org
```

Trebalo bi da vidiš IP adresu (npr. `79.101.226.96`)

**Ako ne vidiš IP adresu:**
- Sačekaj 5-10 minuta (DNS propagacija)
- Ili proveri da li DuckDNS radi

## Rešenje Korak po Korak

### Korak 1: Proveri WebDAV Server

1. Control Panel → File Services → WebDAV
2. Proveri da li je omogućen HTTPS WebDAV service
3. Proveri da li je port 5006

### Korak 2: Proveri Firewall

1. Control Panel → Security → Firewall → Firewall Profile → Edit Rules
2. Proveri da li postoji pravilo za port 5006
3. Ako ne, dodaj pravilo (vidi gore)

### Korak 3: Proveri Router Port Forwarding

1. Ako imaš pristup router-u, proveri port forwarding
2. Ako nemaš pristup router-u, koristi QuickConnect za test

### Korak 4: Test Lokalno

1. Otvori: `https://192.168.100.226:5006` (Synology lokalna IP)
2. Ako radi lokalno, problem je u router-u ili firewall-u
3. Ako ne radi ni lokalno, problem je u WebDAV serveru

### Korak 5: Proveri DuckDNS

1. Otvori: [https://www.duckdns.org](https://www.duckdns.org)
2. Proveri da li je IP adresa tačna
3. Ako nije, ažuriraj manualno

## Alternativa: Koristi QuickConnect za Test

Ako router/firewall ne možeš da rešiš, možeš koristiti QuickConnect za test:

1. Control Panel → External Access → QuickConnect
2. Copy QuickConnect URL (npr. `https://xxx.quickconnect.to`)
3. Testiraj WebDAV preko QuickConnect URL-a:
   ```
   https://xxx.quickconnect.to:5006
   ```

**Napomena:** QuickConnect može raditi iako DuckDNS ne radi, jer QuickConnect koristi drugačiji mehanizam pristupa.

## Sledeći Koraci

1. Proveri WebDAV server (Control Panel → File Services → WebDAV)
2. Proveri firewall (Control Panel → Security → Firewall)
3. Testiraj lokalno (`https://192.168.100.226:5006`)
4. Javi rezultate!
