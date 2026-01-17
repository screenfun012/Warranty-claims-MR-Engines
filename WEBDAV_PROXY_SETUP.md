# WebDAV Proxy Setup na DigitalOcean Droplet-u

## Problem

Port forwarding na router-u nije moguć jer nemaš pristup router-u. Koristimo DigitalOcean Droplet kao proxy za WebDAV.

## Rešenje

Koristimo postojeći DigitalOcean Droplet (139.59.139.89) sa Tailscale kao proxy server za WebDAV.

**Arhitektura:**
```
Vercel → Droplet (139.59.139.89:5006) → Tailscale → Synology (100.80.235.71:5006)
```

## Setup Korak po Korak

### Korak 1: SSH na DigitalOcean Droplet

```bash
ssh root@139.59.139.89
```

### Korak 2: Instaliraj Nginx (Najlakše za HTTP/HTTPS Proxy)

```bash
# Update package list
apt update

# Install Nginx
apt install -y nginx

# Start Nginx
systemctl start nginx
systemctl enable nginx
```

### Korak 3: Konfiguriši Nginx kao WebDAV Proxy

```bash
# Create Nginx config for WebDAV proxy
nano /etc/nginx/sites-available/webdav-proxy
```

**Unesi sledeće:**

```nginx
server {
    listen 5006;
    server_name _;

    # Allow large file uploads
    client_max_body_size 1000M;

    location / {
        # Proxy to Synology WebDAV via Tailscale
        proxy_pass https://100.80.235.71:5006;
        proxy_ssl_verify off;
        proxy_ssl_server_name on;
        proxy_ssl_name 100.80.235.71;
        
        # Proxy headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebDAV specific headers
        proxy_set_header Depth $http_depth;
        proxy_set_header Destination $http_destination;
        proxy_request_buffering off;
        
        # Timeouts for large files
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
        proxy_read_timeout 300;
    }
}
```

**Sačuvaj:**
- `Ctrl+X`
- `Y`
- `Enter`

### Korak 4: Omogući Nginx Config

```bash
# Enable site
ln -s /etc/nginx/sites-available/webdav-proxy /etc/nginx/sites-enabled/

# Test Nginx config
nginx -t

# Reload Nginx
systemctl reload nginx
```

### Korak 5: Otvori Port 5006 na Firewall-u

```bash
# Allow port 5006
ufw allow 5006/tcp

# Enable firewall (if not already enabled)
ufw enable

# Check status
ufw status
```

### Korak 6: Test Proxy Lokalno

```bash
# Test connection to proxy
curl -k https://localhost:5006

# Should connect to Synology WebDAV via Tailscale
```

### Korak 7: Update Vercel Environment Variables

**Vercel Dashboard → Settings → Environment Variables:**

```bash
WEBDAV_URL=https://139.59.139.89:5006
WEBDAV_USERNAME=webdav-user
WEBDAV_PASSWORD=your-password
WEBDAV_BASE_PATH=/volume10/Warranty/REKLAMACIJE
```

**VAŽNO:** 
- Koristiš Droplet public IP (139.59.139.89) umesto FreeDNS domain
- Port je 5006 (isti kao na Synology-u)
- Bez `/webdav` na kraju!

### Korak 8: Redeploy Aplikaciju

1. **Vercel Dashboard → Deployments → Redeploy**
2. Sačekaj da se završi

### Korak 9: Test WebDAV Connection

Otvori: `https://your-app.vercel.app/api/debug/webdav-test`

Trebalo bi da vidiš:
```json
{
  "success": true,
  "message": "WebDAV connection successful!",
  "details": {
    "basePathExists": true,
    "testWriteRead": "successful"
  }
}
```

## Prednosti Ovog Rešenja

- ✅ Ne treba pristup router-u
- ✅ Ne treba port forwarding
- ✅ Koristi postojeći Droplet sa Tailscale
- ✅ Radi direktno sa Vercel-a
- ✅ Fajlovi ostaju na Synology-u

## Troubleshooting

### Problem: Nginx ne startuje

**Rešenje:**
```bash
# Check Nginx status
systemctl status nginx

# Check logs
journalctl -u nginx -f
```

### Problem: Proxy ne može da pristupi Synology-u

**Rešenje:**
```bash
# Test Tailscale connection
ping 100.80.235.71

# Test WebDAV connection from Droplet
curl -k https://100.80.235.71:5006
```

### Problem: Port 5006 nije dostupan

**Rešenje:**
```bash
# Check if port is listening
netstat -tlnp | grep 5006

# Check firewall
ufw status
```

## Alternativa: Koristi NPM Simple WebDAV Proxy (Jednostavnije)

Ako Nginx ne radi, možemo koristiti Node.js proxy (kao što smo imali za IMAP/SMTP):

1. Koristi isti `/opt/tailscale-proxy` folder
2. Dodaj WebDAV proxy fajl
3. Pokreni sa PM2

---

**Javi ako želiš da probamo ovo rešenje!**
