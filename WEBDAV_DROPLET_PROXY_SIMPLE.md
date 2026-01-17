# WebDAV Proxy na DigitalOcean Droplet - Brzi Setup

## Problem

- MTS/Huawei router nije na Synology listi
- Nemaš pristup router-u za ručno podešavanje port forwarding-a
- Synology ne može automatski da setup-uje router

**Rešenje:** Koristi postojeći DigitalOcean Droplet (139.59.139.89) kao proxy za WebDAV!

## Arhitektura

```
Vercel → Droplet (139.59.139.89:5006) → Tailscale → Synology (100.80.235.71:5006)
```

## Setup Korak po Korak (5 minuta)

### Korak 1: SSH na Droplet

```bash
ssh root@139.59.139.89
```

### Korak 2: Instaliraj Nginx

```bash
apt update
apt install -y nginx
systemctl start nginx
systemctl enable nginx
```

### Korak 3: Kreiraj Nginx Config za WebDAV Proxy

```bash
nano /etc/nginx/sites-available/webdav-proxy
```

**Unesi sledeće:**

```nginx
server {
    listen 5006;
    server_name _;

    # Allow large file uploads (1GB)
    client_max_body_size 1000M;

    location / {
        # Proxy to Synology WebDAV via Tailscale
        proxy_pass https://100.80.235.71:5006;
        
        # Disable SSL verification (Synology uses self-signed cert)
        proxy_ssl_verify off;
        proxy_ssl_server_name on;
        
        # Forward original headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebDAV specific headers
        proxy_set_header Depth $http_depth;
        proxy_set_header Destination $http_destination;
        
        # Disable request buffering for large files
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

### Korak 4: Omogući Site i Restart Nginx

```bash
# Enable site
ln -s /etc/nginx/sites-available/webdav-proxy /etc/nginx/sites-enabled/

# Test config
nginx -t

# Restart Nginx
systemctl restart nginx

# Check status
systemctl status nginx
```

### Korak 5: Otvori Port 5006 na Firewall-u

```bash
# Allow port 5006
ufw allow 5006/tcp

# Check status
ufw status
```

### Korak 6: Test Proxy Lokalno (na Droplet-u)

```bash
# Test connection
curl -k https://localhost:5006

# Should return WebDAV response or connection
```

### Korak 7: Update Vercel Environment Variables

**Vercel Dashboard → Settings → Environment Variables:**

**Ažuriraj `WEBDAV_URL`:**
```
WEBDAV_URL=https://139.59.139.89:5006
```

**Proveri ostale varijable:**
- `WEBDAV_USERNAME` - webdav-user
- `WEBDAV_PASSWORD` - tvoja lozinka
- `WEBDAV_BASE_PATH` - /volume10/Warranty/REKLAMACIJE

**VAŽNO:**
- Koristiš **Droplet public IP** (139.59.139.89) umesto FreeDNS domain
- Port je **5006**
- **Bez `/webdav`** na kraju!

### Korak 8: Redeploy Aplikaciju

1. **Vercel Dashboard → Deployments → Redeploy**
2. Sačekaj da se završi (2-5 minuta)

### Korak 9: Test WebDAV Connection

Otvori: `https://your-app.vercel.app/api/debug/webdav-test`

**Očekivani rezultat:**
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
- ✅ Ne treba port forwarding na router-u
- ✅ Koristi postojeći Droplet sa Tailscale
- ✅ Radi direktno sa Vercel-a
- ✅ Fajlovi ostaju na Synology-u
- ✅ Nginx je stabilan i brz

## Troubleshooting

### Problem: Nginx ne startuje

```bash
# Check logs
journalctl -u nginx -n 50

# Check config syntax
nginx -t
```

### Problem: Port 5006 nije dostupan

```bash
# Check if port is listening
netstat -tlnp | grep 5006

# Check firewall
ufw status
```

### Problem: Proxy ne može da pristupi Synology-u

```bash
# Test Tailscale connection
ping 100.80.235.71

# Test WebDAV from Droplet
curl -k -v https://100.80.235.71:5006
```

---

**Javi kada završiš setup i testiraj `/api/debug/webdav-test`!**
