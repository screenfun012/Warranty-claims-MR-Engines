# Synology WebDAV PROPFIND 405 Fix

## Problem

**Greška:** `405 Method Not Allowed` - Nginx prosleđuje PROPFIND zahteve, ali Synology vraća 405.

**Nginx access log pokazuje:**
```
PROPFIND /volume10/Warranty/REKLAMACIJE HTTP/1.1" 405
```

**Uzrok:** Synology WebDAV server možda blokira PROPFIND metode ili ima određena ograničenja.

## Rešenje

### Korak 1: Test Lokalno na Droplet-u

**Proveri da li lokalni test i dalje radi:**

```bash
# Na Droplet-u
curl -k -X PROPFIND https://localhost:5006 \
  -H "Depth: 0" \
  -u "webdav-user:3crpJxrKS60NuE7" \
  2>&1 | head -30
```

**Ako radi lokalno, problem je u tome kako Synology prihvata zahteve sa spoljašnje strane.**

### Korak 2: Test Direktno ka Synology-u (bez proxy-ja)

**Testiraj direktno ka Synology-u sa Droplet-a:**

```bash
# Na Droplet-u
curl -k -X PROPFIND https://100.80.235.71:5006/volume10/Warranty/REKLAMACIJE \
  -H "Depth: 0" \
  -u "webdav-user:3crpJxrKS60NuE7" \
  2>&1 | head -30
```

**Ako radi direktno, problem je u Nginx proxy konfiguraciji.**

### Korak 3: Proveri Synology WebDAV Settings

**Proveri na Synology-u:**

1. **Control Panel → File Services → WebDAV**
   - Proveri da li je "Enable HTTPS WebDAV service" označeno
   - Proveri da li je port 5006 tačan
   - Proveri da li su sve metode dozvoljene

2. **Control Panel → Security → Firewall**
   - Proveri da li port 5006 je dozvoljen za Tailscale IP-ove
   - Proveri da li nema pravila koja blokiraju WebDAV metode

3. **Control Panel → Security → Advanced**
   - Proveri da li nema dodatnih ograničenja za WebDAV

### Korak 4: Proveri Nginx Error Logs

**Proveri da li ima detaljnijih grešaka:**

```bash
# Na Droplet-u
tail -50 /var/log/nginx/error.log
```

**Proveri da li ima SSL grešaka ili drugih problema.**

### Korak 5: Proveri Nginx Access Logs (detaljno)

**Proveri detaljnije Nginx access log:**

```bash
# Na Droplet-u
tail -50 /var/log/nginx/access.log | tail -10
```

**Proveri da li vidiš IP adrese, metode, i status kodove.**

---

## Alternativno: Ažuriraj Nginx Config

**Možda problem je u Host header-u ili drugim header-ima. Hajde da probamo drugačiji pristup:**

### Korak 1: Otvori Nginx Config

```bash
# Na Droplet-u
nano /etc/nginx/sites-available/webdav-proxy
```

### Korak 2: Ažuriraj Config (koristi Host sa portom)

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
        
        # Set Host header to Synology IP with port (not proxy IP)
        proxy_set_header Host 100.80.235.71:5006;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        
        # WebDAV-specific headers (forward all WebDAV headers)
        proxy_set_header Depth $http_depth;
        proxy_set_header Destination $http_destination;
        proxy_set_header Content-Type $http_content_type;
        proxy_set_header Content-Length $http_content_length;
        proxy_set_header Authorization $http_authorization;
        
        # Forward all HTTP methods properly
        proxy_method $request_method;
        
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

**ZAPAMTI:** `proxy_method` direktiva **ne postoji** u standardnom Nginx-u (samo u Nginx Plus)!

**Finalni config (bez `proxy_method`):**

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
        
        # Set Host header to Synology IP with port (not proxy IP)
        proxy_set_header Host 100.80.235.71:5006;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        
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

**Sačuvaj i restartuj Nginx:**

```bash
nginx -t
systemctl restart nginx
```

---

**Javi rezultate:**
1. Da li lokalni test na Droplet-u i dalje radi (`curl -k -X PROPFIND https://localhost:5006`)?
2. Da li direktni test ka Synology-u radi (`curl -k -X PROPFIND https://100.80.235.71:5006/volume10/Warranty/REKLAMACIJE`)?
3. Šta piše u Nginx error log-u (`tail -50 /var/log/nginx/error.log`)?
