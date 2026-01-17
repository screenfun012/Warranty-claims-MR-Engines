# Cloudflare Tunnel Setup (Besplatno, bez port forwarding-a)

Ako nemaš pristup routeru, možeš koristiti Cloudflare Tunnel - besplatno rešenje koje ne zahteva port forwarding!

## Kako radi?

1. **cloudflared** se pokreće na mini računaru
2. Kreira **tunel** između mini računara i Cloudflare-a
3. Cloudflare prosleđuje zahteve ka proxy serveru
4. **Besplatno** - Cloudflare Tunnel je besplatno!

## Setup Korak po Korak

### 1. Instaliraj cloudflared na Mini Računaru

**Windows:**
1. Preuzmi sa: https://github.com/cloudflare/cloudflared/releases
2. Ekstraktuj `cloudflared.exe` u folder (npr. `C:\cloudflared\`)

**Linux:**
```bash
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
chmod +x cloudflared-linux-amd64
sudo mv cloudflared-linux-amd64 /usr/local/bin/cloudflared
```

**macOS:**
```bash
brew install cloudflared
```

### 2. Kreiraj Cloudflare Tunnel

```bash
# Login u Cloudflare (besplatno)
cloudflared tunnel login

# Kreiraj novi tunnel
cloudflared tunnel create email-proxy

# Zapiši Tunnel ID koji se pojavi (trebaće ti!)
```

### 3. Konfiguriši Tunnel

Kreiraj `config.yml` fajl:

```yaml
tunnel: <TUNNEL_ID>
credentials-file: /path/to/<TUNNEL_ID>.json

ingress:
  # IMAP proxy
  - hostname: imap-proxy.yourdomain.com
    service: tcp://localhost:1993
  
  # SMTP proxy
  - hostname: smtp-proxy.yourdomain.com
    service: tcp://localhost:1465
  
  # Health check
  - hostname: proxy-health.yourdomain.com
    service: http://localhost:3000
  
  # Catch-all
  - service: http_status:404
```

**Problem:** Cloudflare Tunnel ne podržava direktno TCP proxying za IMAP/SMTP!

**Rešenje:** Koristimo **Cloudflare Tunnel + Tailscale** kombinaciju:

1. Mini računar: Proxy server + Tailscale
2. Cloudflare Tunnel: Prosleđuje HTTP health check
3. Za IMAP/SMTP: Koristimo direktno Tailscale IP (ako možeš da pristupiš)

**Alternativa:** Koristi **DigitalOcean Droplet** - jednostavnije i radi odmah!

## Preporuka: DigitalOcean Droplet

Bez pristupa routeru, **najlakše rešenje je DigitalOcean Droplet** ($6/mesec):

1. ✅ Ne zahteva pristup routeru
2. ✅ Ima javnu IP adresu automatski
3. ✅ Jednostavno setup (15 minuta)
4. ✅ Pouzdano

Hajde da to uradimo!
