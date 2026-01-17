# Nginx WebDAV 405 Fix - Host Header Problem

## Problem

**Greška:** `405 Method Not Allowed` sa Vercel-a, ali lokalno na Droplet-u radi.

**Uzrok:** Možda problem u Host header-u ili u načinu kako WebDAV klijent komunicira kroz proxy.

## Rešenje

### Korak 1: SSH na Droplet

```bash
ssh root@139.59.139.89
```

### Korak 2: Proveri Trenutni Nginx Config

```bash
cat /etc/nginx/sites-available/webdav-proxy
```

### Korak 3: Ažuriraj Host Header

**Problem:** Nginx možda postavlja Host header na proxy IP umesto na Synology IP ili pravilno prosleđuje.

**Rešenje:** Postavi Host header na Synology IP ili ukloni ga (Nginx će automatski koristiti target server).

**Otvori config:**
```bash
nano /etc/nginx/sites-available/webdav-proxy
```

**Ažuriraj config (podesi Host header na Synology IP ili ukloni ga):**

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
        proxy_ssl_name 100.80.235.71;
        
        # Forward headers
        # Don't set Host header - let Nginx use the target server
        proxy_set_header Host $proxy_host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebDAV headers (forward all WebDAV-specific headers)
        proxy_set_header Depth $http_depth;
        proxy_set_header Destination $http_destination;
        proxy_set_header Content-Type $http_content_type;
        proxy_set_header Content-Length $http_content_length;
        
        # Don't buffer requests (for large files)
        proxy_request_buffering off;
        
        # Long timeouts for large files
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
        proxy_read_timeout 300;
    }
}
```

**Zapravo, možda treba da postavimo Host na Synology domen ili IP:**

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
        proxy_ssl_name 100.80.235.71;
        
        # Forward headers
        # Set Host to Synology IP (not proxy IP)
        proxy_set_header Host 100.80.235.71:5006;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebDAV headers (forward all WebDAV-specific headers)
        proxy_set_header Depth $http_depth;
        proxy_set_header Destination $http_destination;
        proxy_set_header Content-Type $http_content_type;
        proxy_set_header Content-Length $http_content_length;
        
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

**Nakon redeploy-a Vercel aplikacije, testiraj:**

```
https://your-app.vercel.app/api/debug/webdav-test
```

**Trebalo bi da vidiš `"success": true`.**

---

## Alternativno: Proveri Synology WebDAV Settings

**Možda Synology blokira PROPFIND metode iz odredjenih IP adresa.**

**Proveri Synology WebDAV settings:**

1. Control Panel → File Services → WebDAV
2. Proveri da li je "Enable HTTPS WebDAV service" označeno
3. Proveri da li je port 5006 tačan
4. Proveri da li su WebDAV metode dozvoljene

**Ili proveri Synology logs:**

1. Control Panel → Info Center → Log Center
2. Proveri WebDAV logs za 405 greške

---

**Javi rezultate:**
1. Šta piše u trenutnom Nginx config-u (`cat /etc/nginx/sites-available/webdav-proxy`)?
2. Da li `nginx -t` prođe nakon izmene?
3. Da li `curl -k -X PROPFIND https://localhost:5006` i dalje radi?
