# Tailscale Email Proxy Server

Ovaj proxy server omogućava Vercel aplikaciji da pristupa Synology MailPlus Server-u preko Tailscale VPN-a.

## Kako radi?

1. **Proxy server** se pokreće na cloud instanci (DigitalOcean, AWS, itd.)
2. **Proxy je deo Tailscale mreže** - može da pristupi Synology NAS-u preko Tailscale IP-a
3. **Vercel se povezuje na proxy** preko javne IP adrese proxy servera
4. **Proxy prosleđuje zahteve** ka Synology MailPlus Server-u preko Tailscale mreže

## Setup korak po korak

### 1. Kreiraj Cloud Server

**DigitalOcean (preporučeno - najlakše):**
- Kreiraj novi Droplet (Ubuntu 22.04, najmanji plan - $6/mesec)
- Javi mi IP adresu servera

**AWS EC2:**
- Kreiraj t2.micro instancu (free tier)
- Javi mi javnu IP adresu

**Linode:**
- Kreiraj Nanode 1GB ($5/mesec)

### 2. Instaliraj Tailscale na serveru

```bash
# SSH na server
ssh root@YOUR_SERVER_IP

# Instaliraj Tailscale
curl -fsSL https://tailscale.com/install.sh | sh

# Poveži server sa Tailscale mrežom
tailscale up

# Kopiraj link koji se pojavi i otvori ga u browseru da autorizuješ server
```

### 3. Proveri Tailscale IP

```bash
# Proveri Tailscale IP servera
tailscale ip

# Trebalo bi da vidiš nešto kao: 100.80.xxx.xxx
```

### 4. Instaliraj Node.js na serveru

```bash
# Instaliraj Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Proveri verziju
node --version
```

### 5. Deploy Proxy Server

```bash
# Kreiraj direktorijum
mkdir -p /opt/tailscale-proxy
cd /opt/tailscale-proxy

# Upload fajlove (koristi scp ili git)
# Ili kopiraj sadržaj server.js i package.json

# Instaliraj dependencies
npm install

# Kreiraj .env fajl
nano .env
```

**Dodaj u .env:**
```
PROXY_PORT=3000
SYNO_IMAP_HOST=100.80.235.71
SYNO_IMAP_PORT=993
SYNO_SMTP_HOST=100.80.235.71
SYNO_SMTP_PORT=465
IMAP_TCP_PORT=1993
SMTP_TCP_PORT=1465
```

### 6. Pokreni Proxy Server (PM2 za production)

```bash
# Instaliraj PM2
npm install -g pm2

# Pokreni server
pm2 start server.js --name email-proxy

# Sačuvaj PM2 konfiguraciju
pm2 save
pm2 startup

# Proveri status
pm2 status
pm2 logs email-proxy
```

### 7. Otvori Portove na Firewall-u

```bash
# UFW (Ubuntu firewall)
sudo ufw allow 3000/tcp
sudo ufw allow 1993/tcp
sudo ufw allow 1465/tcp
sudo ufw enable
```

### 8. Ažuriraj Vercel Environment Variables

Na Vercel dashboard-u, ažuriraj:

```
IMAP_SERVER=<PROXY_SERVER_PUBLIC_IP>
IMAP_PORT=1993
IMAP_TLS=true

SMTP_SERVER=<PROXY_SERVER_PUBLIC_IP>
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

### Test Proxy Server-a

```bash
# Na proxy serveru
curl http://localhost:3000/health

# Trebalo bi da vidiš:
# {"status":"ok","imap":"100.80.235.71:993","smtp":"100.80.235.71:465"}
```

### Test iz Vercel-a

Nakon što ažuriraš env varijable, testiraj sync u aplikaciji.

## Troubleshooting

### Proxy ne može da se poveže sa Synology-om

1. Proveri da li je proxy server deo Tailscale mreže:
   ```bash
   tailscale status
   ```

2. Proveri da li možeš da ping-uješ Synology:
   ```bash
   ping 100.80.235.71
   ```

3. Proveri da li su portovi otvoreni na Synology firewall-u (993, 465)

### Vercel ne može da se poveže sa proxy-jem

1. Proveri da li je firewall otvoren na proxy serveru:
   ```bash
   sudo ufw status
   ```

2. Proveri da li proxy server radi:
   ```bash
   pm2 status
   pm2 logs email-proxy
   ```

3. Testiraj direktno:
   ```bash
   telnet YOUR_PROXY_IP 1993
   ```

## Alternativno: Koristi Docker

Ako želiš da koristiš Docker:

```bash
# Kreiraj Dockerfile
cat > Dockerfile << EOF
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000 1993 1465
CMD ["node", "server.js"]
EOF

# Build i run
docker build -t email-proxy .
docker run -d -p 3000:3000 -p 1993:1993 -p 1465:1465 --name email-proxy email-proxy
```

## Cena

- **DigitalOcean Droplet**: $6/mesec (najmanji plan)
- **AWS EC2 t2.micro**: Free tier (12 meseci), zatim ~$10/mesec
- **Linode Nanode**: $5/mesec

**Ukupno: ~$5-10/mesec** - mnogo jeftinije od port forwarding-a ili drugih rešenja!
