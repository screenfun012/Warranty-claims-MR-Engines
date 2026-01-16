# DigitalOcean Droplet Setup - Komande

**Droplet IP:** 139.59.139.89

## 1. SSH na Server

```bash
ssh root@139.59.139.89
# Unesi password koji si postavio pri kreiranju Droplet-a
```

## 2. Instaliraj Tailscale

```bash
# Instaliraj Tailscale
curl -fsSL https://tailscale.com/install.sh | sh

# Poveži sa Tailscale mrežom
tailscale up

# Kopiraj link koji se pojavi i otvori ga u browseru
# Autorizuj server u Tailscale admin panelu
```

## 3. Proveri Tailscale IP

```bash
tailscale ip
# Trebalo bi da vidiš: 100.80.xxx.xxx
# Zapiši ovaj IP - trebaće ti za .env fajl!
```

## 4. Instaliraj Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version  # Trebalo bi v18+
```

## 5. Deploy Proxy Server

```bash
# Kreiraj direktorijum
mkdir -p /opt/tailscale-proxy
cd /opt/tailscale-proxy

# Instaliraj git (ako nije instaliran)
apt-get update
apt-get install -y git

# Clone repo (ili upload fajlove ručno)
# Opcija 1: Ako imaš pristup GitHub repo-u
git clone https://github.com/screenfun012/Warranty-claims-MR-Engines.git .
cd tailscale-proxy

# Opcija 2: Ako nemaš pristup, upload fajlove ručno preko scp
# (server.js, package.json iz tailscale-proxy/ foldera)

# Instaliraj dependencies
npm install
```

## 6. Kreiraj .env Fajl

```bash
nano .env
```

**Dodaj sledeće (zameni SYNO_IMAP_HOST sa Tailscale IP-om Synology-a):**

```env
SYNO_IMAP_HOST=100.80.235.71
SYNO_IMAP_PORT=993
SYNO_SMTP_HOST=100.80.235.71
SMTP_PORT=465
IMAP_TCP_PORT=1993
SMTP_TCP_PORT=1465
HEALTH_PORT=3000
```

**Sačuvaj:** `Ctrl+X`, zatim `Y`, zatim `Enter`

## 7. Pokreni Server

```bash
# Instaliraj PM2
npm install -g pm2

# Pokreni server
pm2 start server.js --name email-proxy

# Proveri status
pm2 status
pm2 logs email-proxy

# Auto-start na boot
pm2 save
pm2 startup
# Kopiraj i pokreni komandu koju PM2 da (obično nešto kao):
# sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u root --hp /root
```

## 8. Otvori Portove na Firewall-u

```bash
sudo ufw allow 1993/tcp
sudo ufw allow 1465/tcp
sudo ufw allow 3000/tcp
sudo ufw enable
sudo ufw status  # Proveri da su portovi otvoreni
```

## 9. Test Servera

```bash
# Health check
curl http://localhost:3000/health

# Trebalo bi da vidiš:
# {"status":"ok","imap":"100.80.235.71:993","smtp":"100.80.235.71:465",...}
```

## 10. Ažuriraj Vercel Environment Variables

Na Vercel dashboard-u, dodaj/azuriraj:

```
IMAP_SERVER=139.59.139.89
IMAP_PORT=1993
IMAP_TLS=true

SMTP_SERVER=139.59.139.89
SMTP_PORT=1465
SMTP_TLS=true
```

## Troubleshooting

### Problem: tailscale up traži autorizaciju
- Kopiraj link koji se pojavi
- Otvori ga u browseru
- Autorizuj server u Tailscale admin panelu

### Problem: npm install ne radi
```bash
# Proveri da li je Node.js instaliran
node --version
npm --version

# Ako nije, reinstaliraj:
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### Problem: pm2 ne radi
```bash
# Proveri da li je instaliran
which pm2

# Ako nije, reinstaliraj:
npm install -g pm2
```

### Problem: Portovi nisu otvoreni
```bash
# Proveri firewall status
sudo ufw status

# Ako nisu otvoreni:
sudo ufw allow 1993/tcp
sudo ufw allow 1465/tcp
sudo ufw reload
```

## Gotovo! 🎉

Nakon ovoga, Vercel će moći da pristupa Synology MailPlus Server-u preko proxy-ja!
