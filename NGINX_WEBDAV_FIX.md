# Nginx WebDAV Proxy Fix - "Wrong Version Number"

## Problem

**Greška:**
```
SSL routines::wrong version number
```

**Uzrok:** Nginx ne sluša HTTPS na portu 5006, već HTTP ili uopšte ne radi kako treba.

## Rešenje: Nginx HTTP Listener + Self-Signed Cert

Pošto Nginx ne može da koristi HTTPS bez sertifikata, koristimo HTTP listener i kreiramo self-signed sertifikat.

## Setup Korak po Korak

### Korak 1: Proveri Nginx Status

```bash
# Check if Nginx is running
systemctl status nginx

# Check if port 5006 is listening
netstat -tlnp | grep 5006

# Check Nginx config
nginx -t
```

### Korak 2: Proveri Nginx Config

```bash
# Check current config
cat /etc/nginx/sites-available/webdav-proxy

# Check if file exists
ls -la /etc/nginx/sites-available/webdav-proxy
ls -la /etc/nginx/sites-enabled/webdav-proxy
```

### Korak 3: Kreiraj Self-Signed SSL Sertifikat

```bash
# Create SSL directory
mkdir -p /etc/nginx/ssl

# Generate self-signed certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/nginx/ssl/webdav-proxy.key \
  -out /etc/nginx/ssl/webdav-proxy.crt \
  -subj "/C=RS/ST=Serbia/L=Belgrade/O=MR Engines/CN=139.59.139.89"
```

### Korak 4: Ažuriraj Nginx Config sa SSL

```bash
# Edit config
nano /etc/nginx/sites-available/webdav-proxy
```

**Zameni celokupan sadržaj sa:**

```nginx
server {
    listen 5006 ssl http2;
    server_name _;

    # SSL Certificate
    ssl_certificate /etc/nginx/ssl/webdav-proxy.crt;
    ssl_certificate_key /etc/nginx/ssl/webdav-proxy.key;

    # SSL Settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

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

### Korak 5: Test Config i Restart Nginx

```bash
# Test config
nginx -t

# If OK, restart Nginx
systemctl restart nginx

# Check status
systemctl status nginx

# Check if port is listening
netstat -tlnp | grep 5006
```

### Korak 6: Test Ponovo

```bash
# Test with HTTPS
curl -k -v https://localhost:5006 2>&1 | head -30

# Should show successful TLS handshake
```

**Očekivani rezultat:**
- ✅ TLS handshake successful
- ✅ Connection to Synology
- ✅ WebDAV response (ili neku grešku koja nije "wrong version number")

### Korak 7: Test sa Javne IP

```bash
# Test from outside (opciono)
curl -k -v https://139.59.139.89:5006 2>&1 | head -30
```

## Alternativa: HTTP umesto HTTPS (Jednostavnije)

Ako SSL sertifikat pravi probleme, možemo koristiti HTTP:

```nginx
server {
    listen 5006;
    server_name _;
    
    client_max_body_size 1000M;
    
    location / {
        proxy_pass https://100.80.235.71:5006;
        proxy_ssl_verify off;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_request_buffering off;
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
        proxy_read_timeout 300;
    }
}
```

**Zatim u Vercel:**
```
WEBDAV_URL=http://139.59.139.89:5006
```

(Bez HTTPS - ali to nije bezbedno)

---

**Javi rezultate:**
1. Da li `nginx -t` prođe?
2. Da li `netstat -tlnp | grep 5006` pokazuje nginx?
3. Da li `curl -k https://localhost:5006` sada radi (bez "wrong version number")?
