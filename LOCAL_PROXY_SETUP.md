# Lokalni Proxy Server Setup

Ako imaš mini računar koji može da radi 24/7, možeš ga koristiti kao proxy server umesto cloud servera.

## Prednosti
- ✅ **Besplatno** - samo troškovi struje (~$2-5/mesec)
- ✅ **Jednostavnije** - sve na jednom mestu
- ✅ **Brže** - lokalna mreža

## Zahtevi
- Mini računar (Raspberry Pi, Intel NUC, stari laptop, itd.)
- Windows, Linux, ili macOS
- Tailscale instaliran
- Node.js instaliran
- Računar mora biti uključen 24/7

## Setup Korak po Korak

### 1. Instaliraj Tailscale na Mini Računaru

**Windows:**
1. Preuzmi Tailscale sa https://tailscale.com/download
2. Instaliraj i poveži sa svojim Tailscale nalogom
3. Proveri Tailscale IP: `tailscale ip`

**Linux:**
```bash
curl -fsSL https://tailscale.com/install.sh | sh
tailscale up
```

**macOS:**
1. Preuzmi Tailscale sa https://tailscale.com/download
2. Instaliraj i poveži sa svojim Tailscale nalogom
3. Proveri Tailscale IP: `tailscale ip`

### 2. Instaliraj Node.js

**Windows:**
- Preuzmi sa https://nodejs.org (LTS verzija)
- Instaliraj

**Linux/macOS:**
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs  # Linux
# ili za macOS: brew install node
```

### 3. Deploy Proxy Server

```bash
# Kreiraj direktorijum
mkdir -p ~/tailscale-proxy
cd ~/tailscale-proxy

# Kopiraj fajlove iz tailscale-proxy/ foldera
# (server.js, package.json)

# Instaliraj dependencies
npm install
```

### 4. Konfiguriši .env

Kreiraj `.env` fajl:

```env
SYNO_IMAP_HOST=100.80.235.71
SYNO_IMAP_PORT=993
SYNO_SMTP_HOST=100.80.235.71
SMTP_PORT=465
IMAP_TCP_PORT=1993
SMTP_TCP_PORT=1465
HEALTH_PORT=3000
```

### 5. Port Forwarding na Routeru

**Ovo je ključno!** Treba da prosleđuješ portove sa interneta ka mini računaru:

1. **Pronađi lokalnu IP adresu mini računara:**
   - Windows: `ipconfig` (pogledaj IPv4 adresu)
   - Linux/macOS: `ifconfig` ili `ip addr`
   - Primer: `192.168.1.50`

2. **Idi u router admin panel:**
   - Otvori browser: `http://192.168.1.1` (ili IP tvog routera)
   - Login sa admin kredencijalima

3. **Podesi Port Forwarding:**
   - **Port 1993** → `192.168.1.50:1993` (IMAP)
   - **Port 1465** → `192.168.1.50:1465` (SMTP)
   - **Port 3000** → `192.168.1.50:3000` (Health check - opciono)

4. **Proveri javnu IP adresu:**
   - Idi na https://whatismyipaddress.com
   - Kopiraj javnu IP adresu

### 6. Pokreni Proxy Server

**Windows:**
```bash
# Instaliraj PM2 globalno
npm install -g pm2

# Pokreni server
pm2 start server.js --name email-proxy

# Auto-start na boot
pm2 startup
pm2 save
```

**Linux/macOS:**
```bash
# Instaliraj PM2
npm install -g pm2

# Pokreni server
pm2 start server.js --name email-proxy

# Auto-start na boot
pm2 startup
pm2 save
```

**Alternativa (bez PM2):**
```bash
# Windows: Kreiraj .bat fajl koji se pokreće na startup
# Linux: Koristi systemd service
# macOS: Koristi launchd
```

### 7. Ažuriraj Vercel Environment Variables

Na Vercel dashboard-u:

```
IMAP_SERVER=<JAVNA_IP_ADRESA>
IMAP_PORT=1993
IMAP_TLS=true

SMTP_SERVER=<JAVNA_IP_ADRESA>
SMTP_PORT=1465
SMTP_TLS=true
```

**Primer:**
```
IMAP_SERVER=91.150.91.161
IMAP_PORT=1993
SMTP_SERVER=91.150.91.161
SMTP_PORT=1465
```

## Testiranje

### 1. Test na Mini Računaru

```bash
# Proveri da li server radi
curl http://localhost:3000/health

# Trebalo bi:
# {"status":"ok","imap":"100.80.235.71:993","smtp":"100.80.235.71:465",...}
```

### 2. Test Port Forwarding-a

```bash
# Sa drugog računara (van lokalne mreže)
curl http://<JAVNA_IP>:3000/health

# Trebalo bi da vidiš isti odgovor
```

### 3. Test iz Vercel-a

Nakon što ažuriraš env varijable, testiraj sync u aplikaciji.

## Troubleshooting

### Problem: Ne mogu da pristupim sa interneta

1. **Proveri port forwarding:**
   - Da li su portovi prosleđeni na routeru?
   - Da li je lokalna IP adresa tačna?

2. **Proveri firewall:**
   - Windows: Otvori portove u Windows Firewall
   - Linux: `sudo ufw allow 1993/tcp && sudo ufw allow 1465/tcp`

3. **Proveri da li imaš statičnu javnu IP:**
   - Ako nemaš, javna IP se menja - koristi DDNS (Dynamic DNS)

### Problem: DDNS (Dynamic DNS)

Ako nemaš statičnu javnu IP, koristi DDNS servis:

1. **No-IP** (besplatno): https://www.noip.com
2. **DuckDNS** (besplatno): https://www.duckdns.org
3. **Synology DDNS**: Ako imaš Synology, možeš koristiti njihov DDNS

Nakon što postaviš DDNS, koristi hostname umesto IP adrese u Vercel env varijablama.

### Problem: Mini računar se gasi

- Proveri power settings - onemogući sleep/hibernate
- Windows: Control Panel → Power Options → Never sleep
- Linux: `systemctl mask sleep.target suspend.target hibernate.target`

## Alternativa: Koristi Synology Docker

Ako imaš Synology NAS sa Docker podrškom, možeš pokrenuti proxy server direktno na Synology-u!

1. Instaliraj Docker na Synology
2. Upload `tailscale-proxy/` folder na Synology
3. Pokreni Docker container sa proxy serverom
4. Port forwarding na routeru ka Synology IP-u

## Gotovo! 🎉

Sada Vercel može da pristupa Synology MailPlus Server-u preko tvog mini računara!
