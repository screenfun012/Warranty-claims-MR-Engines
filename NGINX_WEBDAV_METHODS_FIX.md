# Nginx WebDAV Methods Fix - 405 Method Not Allowed

## Problem

**Greška:** `405 Method Not Allowed`

**Uzrok:** Nginx po defaultu blokira neke WebDAV metode (PROPFIND, MKCOL, itd.).

**Rešenje:** Ažurirati Nginx config da dozvoli sve WebDAV metode.

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
        
        # Allow all HTTP methods (WebDAV requires PROPFIND, MKCOL, etc.)
        proxy_method GET;
        proxy_method POST;
        proxy_method PUT;
        proxy_method DELETE;
        proxy_method PROPFIND;
        proxy_method MKCOL;
        proxy_method PROPPATCH;
        proxy_method LOCK;
        proxy_method UNLOCK;
        proxy_method COPY;
        proxy_method MOVE;
        proxy_method HEAD;
        proxy_method OPTIONS;
        
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

**VAŽNO:** `proxy_method` direktiva ne postoji u Nginx-u! To je bila greška.

**Umesto toga, koristi ovaj config:**

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
        
        # WebDAV headers (forward all WebDAV-specific headers)
        proxy_set_header Depth $http_depth;
        proxy_set_header Destination $http_destination;
        proxy_set_header Content-Type $http_content_type;
        proxy_set_header Content-Length $http_content_length;
        
        # Forward all HTTP methods (Nginx by default forwards all methods)
        # But we need to ensure proper handling
        proxy_pass_request_headers on;
        proxy_pass_request_body on;
        
        # Don't buffer requests (for large files)
        proxy_request_buffering off;
        
        # Long timeouts for large files
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
        proxy_read_timeout 300;
        
        # Ensure we forward the HTTP method properly
        proxy_method $request_method;
    }
}
```

**Zapravo, `proxy_method` direktiva postoji u Nginx Plus (plaćena verzija), ali ne u standardnom Nginx-u.**

**Finalni config (bez `proxy_method` direktive):**

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

---

## Alternativno Rešenje (Ako i dalje ne radi)

**Problem možda nije u Nginx-u, već u tome što Synology blokira PROPFIND metode.**

**Proveri Synology WebDAV settings:**

1. Control Panel → File Services → WebDAV
2. Proveri da li je "Enable HTTPS WebDAV service" označeno
3. Proveri da li je port 5006 tačan
4. Proveri da li su WebDAV metode dozvoljene

---

**Javi rezultate:**
1. Da li `nginx -t` prođe?
2. Da li `curl -k -X PROPFIND https://localhost:5006` sada radi?
