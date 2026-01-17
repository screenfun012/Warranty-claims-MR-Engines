# Nginx WebDAV Config Fix - Final

## Problem

**Greška:** `405 Method Not Allowed`

**Uzrok:** 
1. `Host` header je postavljen na proxy IP umesto na Synology IP
2. Nedostaju WebDAV-specific headers (Depth, Destination, itd.)

## Rešenje

### Korak 1: SSH na Droplet

```bash
ssh root@139.59.139.89
```

### Korak 2: Otvori Nginx Config

```bash
nano /etc/nginx/sites-available/webdav-proxy
```

### Korak 3: Ažuriraj Config

**Zameni trenutni config sa ovim:**

```nginx
server {
    listen 5006 ssl;
    server_name _;

    ssl_certificate /etc/nginx/ssl/webdav-proxy.crt;
    ssl_certificate_key /etc/nginx/ssl/webdav-proxy.key;
    ssl_protocols TLSv1.2 TLSv1.3;

    client_max_body_size 1000M;

    location / {
        # Proxy to Synology WebDAV via Tailscale
        proxy_pass https://100.80.235.71:5006;
        
        # Don't verify SSL (Synology uses self-signed cert)
        proxy_ssl_verify off;
        proxy_ssl_server_name on;
        proxy_ssl_name 100.80.235.71;
        
        # Set Host header to Synology IP (not proxy IP)
        proxy_set_header Host 100.80.235.71:5006;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebDAV-specific headers (forward all WebDAV headers)
        proxy_set_header Depth $http_depth;
        proxy_set_header Destination $http_destination;
        proxy_set_header Content-Type $http_content_type;
        proxy_set_header Content-Length $http_content_length;
        proxy_set_header Authorization $http_authorization;
        
        # Don't buffer requests (for large files)
        proxy_request_buffering off;
        
        # Long timeouts for large files
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
        proxy_read_timeout 300;
        
        # Forward all HTTP methods (Nginx does this by default, but ensure it)
        proxy_pass_request_headers on;
        proxy_pass_request_body on;
    }
}
```

**VAŽNO:**
- `proxy_set_header Host 100.80.235.71:5006;` - Postavlja Host na Synology IP (ne proxy IP!)
- `proxy_set_header Depth $http_depth;` - Prosleđuje Depth header (za PROPFIND)
- `proxy_set_header Destination $http_destination;` - Prosleđuje Destination header (za COPY/MOVE)
- `proxy_set_header Authorization $http_authorization;` - Prosleđuje Authorization header (za autentifikaciju)

**Sačuvaj:**
- `Ctrl+X`
- `Y`
- `Enter`

### Korak 4: Test Nginx Config

```bash
# Test Nginx config
nginx -t
```

**Očekivani rezultat:**
```
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: the configuration file /etc/nginx/nginx.conf test is successful
```

### Korak 5: Restart Nginx

```bash
# Restart Nginx
systemctl restart nginx

# Check status
systemctl status nginx
```

### Korak 6: Test WebDAV sa Droplet-a

```bash
# Test PROPFIND (standardna WebDAV metoda)
curl -k -X PROPFIND https://localhost:5006 \
  -H "Depth: 0" \
  -u "webdav-user:3crpJxrKS60NuE7" \
  2>&1 | head -30
```

**Trebalo bi da vidiš WebDAV XML response (bez 405 greške).**

### Korak 7: Test sa Spoljšnje Strane (sa Vercel-a)

**Nakon redeploy-a Vercel aplikacije (ako je potrebno), testiraj:**

```
https://your-app.vercel.app/api/debug/webdav-test
```

**Trebalo bi da vidiš `"success": true`.**

---

## Troubleshooting

### Problem: "405 Method Not Allowed" i dalje

**Ako i dalje vidiš 405 grešku:**

1. Proveri da li Synology WebDAV dozvoljava PROPFIND metode:
   - Control Panel → File Services → WebDAV
   - Proveri da li su sve metode dozvoljene

2. Proveri Nginx logs:
   ```bash
   tail -50 /var/log/nginx/error.log
   tail -50 /var/log/nginx/access.log
   ```

3. Proveri da li WebDAV klijent koristi pravilne metode:
   - WebDAV klijent koristi `webdav` npm paket
   - Proveri da li paket koristi PROPFIND metode pravilno

### Problem: "401 Unauthorized"

**Ako vidiš 401 grešku:**

1. Proveri da li `Authorization` header pravilno prosleđuje:
   - Proveri `proxy_set_header Authorization $http_authorization;`
   - Proveri da li WebDAV credentials su ispravni

2. Proveri da li Synology WebDAV dozvoljava autentifikaciju:
   - Control Panel → File Services → WebDAV
   - Proveri da li je autentifikacija omogućena

---

**Javi rezultate:**
1. Da li `nginx -t` prođe nakon izmene?
2. Da li `curl -k -X PROPFIND https://localhost:5006` i dalje radi?
3. Da li `/api/debug/webdav-test` sada radi sa Vercel-a?
