# WebDAV Connection Refused - Detaljno Rešenje

## Problem

**Greška:**
```
ERR_CONNECTION_REFUSED
mr-engines.duckdns.org refused to connect
```

**Uzrok:** Konekcija ne dopire do Synology WebDAV servera na portu 5006.

## Provera Korak po Korak

### Korak 1: Proveri WebDAV Server Status

1. **Synology DSM → Package Center**
2. Pronađi **"WebDAV Server"**
3. Proveri da li je status: **"Running"** (zeleno)
4. Ako nije running, klikni **"Open"** ili **"Start"**

### Korak 2: Proveri WebDAV Settings

1. Otvori **WebDAV Server** aplikaciju
2. Idi u **Settings** tab
3. Proveri:
   - ☑ **"Enable HTTPS"** je označeno
   - Port je **5006**
4. Klikni **"Apply"** ako si nešto promenio

### Korak 3: Proveri Firewall na Synology-u

1. **Control Panel → Security → Firewall**
2. Proveri da li je firewall **omogućen**
3. Ako je omogućen, klikni **"Firewall Profile"** → **"Edit Rules"**
4. Proveri da li postoji pravilo za port **5006**

**Ako ne postoji pravilo, dodaj:**

1. Klikni **"Create"**
2. Popuni:
   - **Action:** Allow
   - **Protocol:** TCP
   - **Port:** `5006`
   - **Source IP:** All (ili ostavi prazno)
   - **Destination IP:** All (ili ostavi prazno)
3. Klikni **"OK"**
4. Klikni **"Apply"**

### Korak 4: Test Lokalno (NAJVAŽNIJE!)

**Test sa lokalne mreže:**

1. Na bilo kom računaru u istoj lokalnoj mreži
2. Otvori browser
3. Idi na: `https://192.168.100.226:5006` (Synology lokalna IP)
4. ILI: `https://MREngines:5006` (Synology hostname)

**Rezultat:**
- ✅ Ako radi lokalno → Problem je u router-u ili DuckDNS-u
- ❌ Ako ne radi ni lokalno → Problem je u WebDAV serveru ili firewall-u na Synology-u

### Korak 5: Proveri Router Port Forwarding

**Ako lokalno radi ali ne radi preko DuckDNS:**

1. Idi u **router settings** (ako imaš pristup)
2. Proveri da li postoji **Port Forwarding** pravilo za port **5006**
3. Ako ne postoji, dodaj:
   - **External Port:** `5006`
   - **Internal IP:** `192.168.100.226` (Synology IP)
   - **Internal Port:** `5006`
   - **Protocol:** TCP

**Napomena:** Ako nemaš pristup router-u, možda treba da koristiš QuickConnect ili drugi način.

### Korak 6: Proveri DuckDNS IP Ažuriranje

1. Otvori: [https://www.duckdns.org](https://www.duckdns.org)
2. Login sa Google-om
3. Proveri da li je IP adresa tačna
4. Ako nije, klikni **"Update IP"** ili otvori:
   ```
   https://www.duckdns.org/update?domains=mr-engines&token=7b096e06-4f78-417c-bd07-cb109122f67a
   ```
   Trebalo bi da vidiš: `OK`

### Korak 7: Test sa Terminala (Advanced)

**Test sa terminala (Mac/Linux):**
```bash
curl -k -v https://mr-engines.duckdns.org:5006
```

**Test sa terminala (Windows PowerShell):**
```powershell
Test-NetConnection -ComputerName mr-engines.duckdns.org -Port 5006
```

## Najverovatniji Uzroci

### 1. Firewall Blokira Port 5006 (Najverovatnije)

**Rešenje:**
- Control Panel → Security → Firewall → Firewall Profile → Edit Rules
- Dodaj pravilo za port 5006 (vidi Korak 3)

### 2. WebDAV Server Nije Omogućen ili Ne Radi

**Rešenje:**
- Package Center → WebDAV Server → Proveri da li je "Running"
- WebDAV Server aplikacija → Settings → Proveri da li je "Enable HTTPS" označeno

### 3. Router Blokira Port 5006

**Rešenje:**
- Dodaj port forwarding na router-u (ako imaš pristup)
- ILI koristi QuickConnect

### 4. DuckDNS Nije Tačno Ažuriran

**Rešenje:**
- Proveri DuckDNS IP adresu
- Manualno ažuriraj IP ako treba

## Sledeći Koraci

**Proveri redom:**
1. Da li WebDAV Server radi (Package Center → Running status)?
2. Da li je "Enable HTTPS" označeno (WebDAV Server → Settings)?
3. Da li radi lokalno (`https://192.168.100.226:5006`)?
4. Da li postoji firewall pravilo za port 5006?

**Javi rezultate:**
- Da li WebDAV Server radi (Running)?
- Da li radi lokalno?
- Da li postoji firewall pravilo za port 5006?

Na osnovu toga ćemo tačno videti gde je problem!
