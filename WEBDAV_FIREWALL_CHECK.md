# WebDAV Firewall Check - Troubleshooting

## Problem

`ufw status | grep 5006` ne vraća ništa, iako je pravilo dodato.

## Rešenje

### Korak 1: Proveri UFW Status Kompletno

```bash
# Proveri da li je UFW aktiviran
ufw status verbose

# Ili samo
ufw status
```

**Očekivani rezultat:**
```
Status: active

To                         Action      From
--                         ------      ----
22/tcp                     ALLOW       Anywhere
5006/tcp                   ALLOW       Anywhere
22/tcp (v6)                ALLOW       Anywhere (v6)
5006/tcp (v6)              ALLOW       Anywhere (v6)
```

### Korak 2: Ako UFW nije Aktiviran

**Ako vidiš `Status: inactive`:**
```bash
# Aktiviraj UFW
ufw enable

# Dodaj ponovo pravilo
ufw allow 5006/tcp

# Proveri status
ufw status
```

### Korak 3: Alternativni Način - Proveri sa `ss`

```bash
# Proveri da li port sluša na javnom IP-u
ss -tlnp | grep 5006

# Trebalo bi da vidiš:
# LISTEN 0 511 0.0.0.0:5006
# (0.0.0.0 znači da sluša na svim interfejsima, uključujući javni IP)
```

### Korak 4: Test sa Spoljšnje Strane

**Ako `ss -tlnp | grep 5006` pokazuje `0.0.0.0:5006`, port je dostupan!**

**Test sa spoljšnje strane (sa tvog računara):**
```bash
# Sa tvog računara (ne sa Droplet-a!)
curl -k -X PROPFIND https://139.59.139.89:5006 \
  -H "Depth: 0" \
  -u "webdav-user:3crpJxrKS60NuE7" \
  2>&1 | head -30
```

**Ako vidiš WebDAV XML response, proxy je dostupan sa spoljšnje strane!**

---

## Ako i dalje ne radi

**Ako port nije dostupan sa spoljšnje strane:**

1. Proveri da li DigitalOcean ima dodatne firewall pravila:
   - DigitalOcean Dashboard → Networking → Firewalls
   - Proveri da li postoji firewall grupa i da li dozvoljava port 5006

2. Proveri da li Nginx konfiguracija pravilno sluša:
   ```bash
   # Proveri Nginx config
   cat /etc/nginx/sites-available/webdav-proxy | grep listen
   
   # Trebalo bi da vidiš:
   # listen 5006;
   ```

3. Proveri Nginx logs:
   ```bash
   tail -f /var/log/nginx/error.log
   ```

---

**Javi rezultate:**
1. Šta piše kada pokreneš `ufw status` (bez grep)?
2. Da li `ss -tlnp | grep 5006` pokazuje `0.0.0.0:5006`?
3. Da li želiš da probamo test sa spoljšnje strane?
