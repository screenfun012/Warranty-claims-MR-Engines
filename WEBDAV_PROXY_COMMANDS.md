# WebDAV Proxy Setup - Komande za Kopiranje

## Provera Trenutnog Stanja

```bash
# Proveri da li config postoji i kako izgleda
cat /etc/nginx/sites-available/webdav-proxy

# Proveri da li Nginx radi
systemctl status nginx

# Proveri da li port sluša
netstat -tlnp | grep 5006
```

## Rešenje: Kreiraj SSL Sertifikat i Ažuriraj Config

### Korak 1: Kreiraj SSL Sertifikat

```bash
# Kreiraj SSL direktorijum
mkdir -p /etc/nginx/ssl

# Generiši self-signed sertifikat
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/nginx/ssl/webdav-proxy.key \
  -out /etc/nginx/ssl/webdav-proxy.crt \
  -subj "/C=RS/ST=Serbia/L=Belgrade/O=MR Engines/CN=139.59.139.89"
```

### Korak 2: Ažuriraj Nginx Config

```bash
# Backup stari config (ako treba)
cp /etc/nginx/sites-available/webdav-proxy /etc/nginx/sites-available/webdav-proxy.backup

# Edit config
nano /etc/nginx/sites-available/webdav-proxy
```

**Obriši SVE i unesi ovo:**

```nginx
server {
    listen 5006 ssl;
    server_name _;

    # SSL Certificate
    ssl_certificate /etc/nginx/ssl/webdav-proxy.crt;
    ssl_certificate_key /etc/nginx/ssl/webdav-proxy.key;

    # SSL Settings
    ssl_protocols TLSv1.2 TLSv1.3;

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

### Korak 3: Test Config i Restart Nginx

```bash
# Test config (VERY IMPORTANT!)
nginx -t

# Ako test prođe, restart Nginx
systemctl restart nginx

# Proveri status
systemctl status nginx

# Proveri da li port sluša
netstat -tlnp | grep 5006
```

### Korak 4: Test Proxy

```bash
# Test sa HTTPS (sa self-signed cert)
curl -k -v https://localhost:5006 2>&1 | head -30
```

**Očekivani rezultat:**
- ✅ Nginx sluša na portu 5006
- ✅ TLS handshake successful
- ✅ Connection to Synology (ili neka greška koja nije "wrong version number")

---

**Javi rezultate:**
1. Da li `nginx -t` prođe?
2. Da li `netstat -tlnp | grep 5006` pokazuje nginx?
3. Šta piše kada pokreneš `curl -k https://localhost:5006`?
