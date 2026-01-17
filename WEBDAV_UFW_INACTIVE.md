# WebDAV Firewall - UFW Inactive

## Status

✅ **UFW nije aktiviran** - to znači da firewall ne blokira port 5006
✅ **Port 5006 je verovatno već dostupan** (ako nema drugog firewall-a)

## Provera

### Korak 1: Proveri da li Port Sluša na Javnom IP-u

```bash
# Proveri da li port sluša na svim interfejsima
ss -tlnp | grep 5006

# Trebalo bi da vidiš:
# LISTEN 0 511 0.0.0.0:5006  (znači da sluša na javnom IP-u)
# Ako vidiš 127.0.0.1:5006, to znači da sluša samo lokalno (loše)
```

### Korak 2: Ako Port Sluša na 0.0.0.0:5006

**Port je dostupan sa spoljšnje strane! Možemo nastaviti sa ažuriranjem Vercel!**

### Korak 3: Aktiviraj UFW za Sigurnost (Opciono)

**Ako želiš da aktiviraš firewall za sigurnost:**

```bash
# Aktiviraj UFW
ufw enable

# Dodaj pravilo za port 5006
ufw allow 5006/tcp

# Proveri status
ufw status

# Trebalo bi da vidiš:
# Status: active
# 5006/tcp                   ALLOW       Anywhere
```

**VAŽNO:** Ako aktiviraš UFW, proveri da li je SSH (port 22) dozvoljen, jer ako nije, možeš izgubiti pristup serveru!

```bash
# Pre aktivacije UFW, dodaj SSH pravilo
ufw allow 22/tcp

# Tek onda aktiviraj UFW
ufw enable
```

---

**Javi rezultat:**
1. Šta piše kada pokreneš `ss -tlnp | grep 5006`?

**Ako vidiš `0.0.0.0:5006`, port je dostupan i možemo ažurirati Vercel!**
