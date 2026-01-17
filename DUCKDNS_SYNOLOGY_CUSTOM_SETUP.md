# DuckDNS Custom Setup na Synology-u - Korak po Korak

## Tvoji Podaci

- **Domain:** `mr-engines.duckdns.org`
- **Token:** `7b096e06-4f78-417c-bd07-cb109122f67a`
- **Current IP:** `79.101.226.96`

## Setup Korak po Korak

### Korak 1: Otvori DDNS Settings

1. **Synology DSM** → **Control Panel** → **External Access** → **DDNS** tab
2. Klikni **"Add"**

### Korak 2: Klikni "Customize Provider"

U "Add DDNS" dialog-u:
1. Klikni dugme **"Customize Provider"** (pored Service Provider dropdown-a)
2. Trebalo bi da se otvori novi prozor za custom provider setup

### Korak 3: Konfiguriši Custom DuckDNS Provider

U "Customize Provider" prozoru:

**Query URL:**
Unesi:
```
https://www.duckdns.org/update?domains=__HOSTNAME__&token=__PASSWORD__&ip=__MYIP__
```

**HOSTNAME:**
```
mr-engines
```
(Napomena: bez `.duckdns.org` - samo subdomain)

**Username / Password:**
```
7b096e06-4f78-417c-bd07-cb109122f67a
```
(Tvoj token)

**Alias:**
```
DuckDNS
```
(Ili bilo koji naziv koji želiš)

Klikni **"OK"** da sačuvaš custom provider.

### Korak 4: Koristi Custom Provider u DDNS Setup-u

Sada u "Add DDNS" dialog-u:

**Service Provider:**
- Izaberi **"DuckDNS"** (custom provider koji si upravo kreirao)

**Hostname:**
- Unesi: `mr-engines.duckdns.org`

**Username/Email:**
- Unesi: `mr-engines`

**Password/Token:**
- Unesi: `7b096e06-4f78-417c-bd07-cb109122f67a`

**External Address (IPv4):**
- Ostavi **PRAZNO**

Klikni **"OK"** da sačuvaš DDNS entry.

### Korak 5: Proveri Status

Trebalo bi da vidiš:
- ✅ Zeleni check mark
- Status: **"Normal"**
- External Address: `79.101.226.96`

---

## Alternativa: Koristi "Custom" Provider Direktno

Ako "Customize Provider" ne radi, možeš koristiti **"Custom"** iz dropdown-a:

### Opcija 1: Koristi Custom sa Query URL-om

**Service Provider:**
- Izaberi **"Custom"** iz dropdown-a (ako postoji)

**Query URL:**
```
https://www.duckdns.org/update?domains=mr-engines&token=7b096e06-4f78-417c-bd07-cb109122f67a&ip=__MYIP__
```

**Hostname:**
```
mr-engines.duckdns.org
```

**Username/Email:**
```
mr-engines
```

**Password/Token:**
```
7b096e06-4f78-417c-bd07-cb109122f67a
```

---

## Alternativa: Manual Update DuckDNS (Ako Synology ne radi)

Ako Synology ne može automatski da ažurira DuckDNS, možeš manualno ažurirati:

### Opcija 1: Browser Update

Otvori u browser-u:
```
https://www.duckdns.org/update?domains=mr-engines&token=7b096e06-4f78-417c-bd07-cb109122f67a&ip=79.101.226.96
```

Trebalo bi da vidiš: `OK`

### Opcija 2: Cron Job na Synology-u (Automatsko ažuriranje)

1. **Control Panel** → **Task Scheduler** → **Create** → **Scheduled Task** → **User-defined script**

2. **General:**
   - Task: `DuckDNS Update`
   - User: `root`
   - Enable: ✓

3. **Schedule:**
   - Run on the following days: **Every day**
   - Time: **Every 5 minutes** (ili kako želiš)

4. **Task Settings:**
   - **Run command:** `curl -s "https://www.duckdns.org/update?domains=mr-engines&token=7b096e06-4f78-417c-bd07-cb109122f67a&ip=$(curl -s https://api.ipify.org)"`

5. **Save**

---

## Provera da li Radi

**Test 1: Browser Test**
1. Otvori: `https://mr-engines.duckdns.org:5006`
2. Trebalo bi da se poveže na Synology

**Test 2: Proveri DuckDNS Status**
1. Otvori: `https://www.duckdns.org/update?domains=mr-engines&token=7b096e06-4f78-417c-bd07-cb109122f67a`
2. Trebalo bi da vidiš: `OK` ili trenutnu IP adresu

**Test 3: Proveri DDNS Status na Synology-u**
- Control Panel → External Access → DDNS
- Trebalo bi da vidiš zeleni check mark i "Normal" status

---

## Sledeći Korak: Update Vercel

Nakon što DuckDNS radi:

1. **Update Vercel Environment Variables:**
   ```
   WEBDAV_URL=https://mr-engines.duckdns.org:5006
   ```

2. **Redeploy aplikaciju**

3. **Testiraj:**
   ```
   https://your-app.vercel.app/api/debug/webdav-test
   ```
