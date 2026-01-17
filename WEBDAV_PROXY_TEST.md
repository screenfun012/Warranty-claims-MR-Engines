# WebDAV Proxy Test - Nastavak

## Status

✅ Nginx config validan (`nginx -t` prođe)
✅ Nginx radi i prosleđuje zahteve (404 response umesto "connection refused")

**404 greška je OK!** To znači da proxy radi i prosleđuje zahteve ka Synology-u, ali možda Synology vraća 404 za root path.

## Test sa WebDAV Komandom

### Korak 1: Proveri da li Port Sluša

```bash
# Koristi 'ss' umesto 'netstat' (sadašnji Ubuntu)
ss -tlnp | grep 5006

# Ili proveri Nginx proces
ps aux | grep nginx
```

### Korak 2: Test sa WebDAV PROPFIND Komandom

```bash
# Test sa WebDAV PROPFIND (WebDAV standard komanda)
curl -k -X PROPFIND https://localhost:5006 \
  -H "Depth: 0" \
  -u "webdav-user:password" \
  2>&1 | head -30
```

**Zameni `webdav-user:password` sa tvojim WebDAV credentials!**

**Očekivani rezultat:**
- ✅ WebDAV response (XML format) ili
- ✅ HTTP 401 (Unauthorized) - to je OK, znači da WebDAV server radi!
- ❌ "wrong version number" ili "connection refused" - to bi bilo loše

### Korak 3: Test sa Specificnom Putanjom

```bash
# Test sa WebDAV base path
curl -k -X PROPFIND https://localhost:5006/volume10/Warranty/REKLAMACIJE \
  -H "Depth: 0" \
  -u "webdav-user:password" \
  2>&1 | head -30
```

## Ako Test Prođe

**Ako vidiš WebDAV response ili HTTP 401 (Unauthorized), proxy RАDI!**

**Sledeći korak:** Ažuriraj Vercel environment varijable:

```
WEBDAV_URL=https://139.59.139.89:5006
```

**I redeploy aplikaciju.**

## Ako Test Ne Prođe

**Ako i dalje vidiš "connection refused" ili "wrong version number":**

1. Proveri Nginx logs:
   ```bash
   journalctl -u nginx -n 50
   tail -f /var/log/nginx/error.log
   ```

2. Proveri da li Synology WebDAV radi:
   ```bash
   curl -k https://100.80.235.71:5006 2>&1 | head -20
   ```

---

**Javi rezultate:**
1. Da li `ss -tlnp | grep 5006` pokazuje nginx?
2. Šta piše kada pokreneš PROPFIND komandu?
3. Da li vidiš WebDAV response ili HTTP 401?
