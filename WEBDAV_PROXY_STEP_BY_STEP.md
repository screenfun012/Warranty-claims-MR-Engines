# WebDAV Proxy Setup - Korak po Korak (Provereno)

## Plan

1. Setup Nginx proxy na Droplet-u
2. Test lokalno na Droplet-u PRVO (pre nego što promenimo Vercel)
3. Ako radi, onda ažuriramo Vercel
4. Ako ne radi, koristimo Vercel Blob privremeno

## Setup Korak po Korak

### Korak 1: SSH na Droplet

```bash
ssh root@139.59.139.89
```

### Korak 2: Instaliraj Nginx (ako već nije instaliran)

```bash
# Check if Nginx is installed
which nginx

# If not installed, install it
apt update
apt install -y nginx

# Start Nginx
systemctl start nginx
systemctl enable nginx

# Check status
systemctl status nginx
```

### Korak 3: Kreiraj Nginx Config za WebDAV Proxy

```bash
# Create config file
nano /etc/nginx/sites-available/webdav-proxy
```

**Unesi TACNO ovo:**

```nginx
server {
    listen 5006;
    server_name _;
    
    # Allow large file uploads (1GB)
    client_max_body_size 1000M;
    
    location / {
        # Proxy to Synology WebDAV via Tailscale
        proxy_pass https://100.80.235.71:5006;
        
        # Don't verify SSL (Synology uses self-signed cert)
        proxy_ssl_verify off;
        proxy_ssl_server_name on;
        
        # Forward headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebDAV headers
        proxy_set_header Depth $http_depth;
        proxy_set_header Destination $http_destination;
        
        # Don't buffer requests (for large files)
        proxy_request_buffering off;
        
        # Long timeouts for large files
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

### Korak 4: Omogući Site i Test Config

```bash
# Enable site
ln -s /etc/nginx/sites-available/webdav-proxy /etc/nginx/sites-enabled/

# Test Nginx config (VERY IMPORTANT!)
nginx -t
```

**Očekivani rezultat:**
```
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: configuration file /etc/nginx/nginx.conf test is successful
```

**Ako vidiš grešku, javi mi šta piše!**

### Korak 5: Restart Nginx

```bash
# Restart Nginx
systemctl restart nginx

# Check status
systemctl status nginx
```

**Trebalo bi da vidiš:**
```
Active: active (running)
```

### Korak 6: Otvori Port 5006 na Firewall-u

```bash
# Allow port 5006
ufw allow 5006/tcp

# Check status
ufw status
```

**Trebalo bi da vidiš:**
```
5006/tcp                    ALLOW       Anywhere
```

### Korak 7: Test Proxy Lokalno (NA DROPLET-U!)

**Ovo je NAJVAŽNIJE - testiramo PRVO na Droplet-u pre nego što promenimo Vercel!**

```bash
# Test connection to proxy
curl -k -v https://localhost:5006 2>&1 | head -20

# Should show connection attempt to Synology
```

**Ili:**

```bash
# Test with WebDAV PROPFIND command
curl -k -X PROPFIND https://localhost:5006 -H "Depth: 0" -u "webdav-user:password" 2>&1 | head -30
```

**Ako vidiš WebDAV response ili neku grešku koja nije "connection refused", to je dobar znak!**

### Korak 8: Test sa Spoljašnjeg Servera (opciono)

**Ako želiš da testiraš sa drugog servera:**
```bash
curl -k -v https://139.59.139.89:5006 2>&1 | head -20
```

**Ako vidiš WebDAV response, proxy radi!**

### Korak 9: JAVI MI REZULTATE PRE NEŠTO ŠTO PROMENIMO VERCEL!

**Javi:**
1. Da li `nginx -t` prođe bez grešaka?
2. Da li `systemctl status nginx` pokazuje "active (running)"?
3. Da li `curl -k https://localhost:5006` vraća nešto (bilo šta osim "connection refused")?

**NAKON što potvrdiš da proxy radi lokalno na Droplet-u, onda ćemo ažurirati Vercel!**

## Troubleshooting

### Problem: Nginx ne startuje

```bash
# Check logs
journalctl -u nginx -n 50

# Check config
nginx -t
```

### Problem: Port 5006 nije dostupan

```bash
# Check if port is listening
netstat -tlnp | grep 5006

# Should show nginx listening on 5006
```

### Problem: Proxy ne može da pristupi Synology-u

```bash
# Test Tailscale connection
ping 100.80.235.71

# Test WebDAV from Droplet to Synology
curl -k -v https://100.80.235.71:5006 2>&1 | head -20
```

---

**Javi mi rezultate sa Droplet-a PRE nego što promenimo Vercel environment varijable!**
