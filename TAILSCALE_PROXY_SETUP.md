# Tailscale Proxy Setup - Brzi Vodič

## Problem
Vercel serverless funkcije ne mogu direktno da pristupe Tailscale VPN mreži. Trebamo proxy server koji je deo Tailscale mreže.

## Rešenje
Mali cloud server (DigitalOcean/AWS) koji:
- ✅ Je deo Tailscale mreže
- ✅ Ima javnu IP adresu
- ✅ Prosleđuje IMAP/SMTP zahteve ka Synology-u

## Koraci

### 1. Kreiraj DigitalOcean Droplet (5 minuta)

1. Idi na https://www.digitalocean.com
2. Kreiraj novi Droplet:
   - **Image**: Ubuntu 22.04
   - **Plan**: Basic - $6/mesec (najmanji)
   - **Region**: Bilo koji (najbliži tebi)
   - **Authentication**: SSH keys (ili password)
3. **Kopiraj javnu IP adresu** - trebaće ti!

### 2. Instaliraj Tailscale (2 minuta)

```bash
# SSH na server
ssh root@YOUR_DROPLET_IP

# Instaliraj Tailscale
curl -fsSL https://tailscale.com/install.sh | sh

# Poveži sa Tailscale mrežom
tailscale up

# Kopiraj link koji se pojavi i otvori ga u browseru
# Autorizuj server u Tailscale admin panelu
```

### 3. Proveri Tailscale IP

```bash
tailscale ip
# Trebalo bi da vidiš: 100.80.xxx.xxx
```

### 4. Instaliraj Node.js (1 minut)

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version  # Trebalo bi da vidiš v18+
```

### 5. Deploy Proxy Server (3 minuta)

```bash
# Kreiraj direktorijum
mkdir -p /opt/tailscale-proxy
cd /opt/tailscale-proxy

# Upload fajlove (koristi scp)
# Ili kopiraj sadržaj iz tailscale-proxy/ foldera

# Instaliraj dependencies
npm install

# Kreiraj .env
nano .env
```

**Dodaj u .env:**
```
PROXY_PORT=3000
SYNO_IMAP_HOST=100.80.235.71
SYNO_IMAP_PORT=993
SYNO_SMTP_HOST=100.80.235.71
SMTP_PORT=465
IMAP_TCP_PORT=1993
SMTP_TCP_PORT=1465
```

### 6. Pokreni Server (2 minuta)

```bash
# Instaliraj PM2
npm install -g pm2

# Pokreni
pm2 start server.js --name email-proxy

# Auto-start na boot
pm2 save
pm2 startup
```

### 7. Otvori Portove (1 minut)

```bash
sudo ufw allow 1993/tcp
sudo ufw allow 1465/tcp
sudo ufw enable
```

### 8. Ažuriraj Vercel Env Variables

Na Vercel dashboard-u:

```
IMAP_SERVER=<DROPLET_PUBLIC_IP>
IMAP_PORT=1993
IMAP_TLS=true

SMTP_SERVER=<DROPLET_PUBLIC_IP>
SMTP_PORT=1465
SMTP_TLS=true
```

**Primer:**
```
IMAP_SERVER=159.89.123.45
IMAP_PORT=1993
SMTP_SERVER=159.89.123.45
SMTP_PORT=1465
```

## Testiranje

```bash
# Na proxy serveru
curl http://localhost:3000/health

# Trebalo bi:
# {"status":"ok","imap":"100.80.235.71:993","smtp":"100.80.235.71:465"}
```

## Ukupno Vreme: ~15 minuta

## Cena: $6/mesec (DigitalOcean)

## Troubleshooting

**Problem**: Proxy ne može da se poveže sa Synology-om
- Proveri: `tailscale status` - server mora biti u mreži
- Proveri: `ping 100.80.235.71` - mora da radi

**Problem**: Vercel ne može da se poveže
- Proveri: `sudo ufw status` - portovi moraju biti otvoreni
- Proveri: `pm2 logs email-proxy` - server mora da radi

## Gotovo! 🎉

Nakon ovoga, Vercel će moći da pristupa Synology MailPlus Server-u preko proxy-ja!
