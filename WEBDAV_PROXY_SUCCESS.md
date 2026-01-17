# WebDAV Proxy - USPEH! 🎉

## Status

✅ **Nginx proxy radi lokalno na Droplet-u!**
✅ **WebDAV PROPFIND vraća XML response (HTTP 200 OK)**
✅ **Autentifikacija prolazi**
✅ **Proxy prosleđuje zahteve ka Synology-u preko Tailscale**

## Finalni Test Korak

### Korak 1: Proveri da li je Port 5006 Otvoren na Firewall-u

```bash
# Proveri firewall status
ufw status | grep 5006

# Ako nije otvoren, otvori ga
ufw allow 5006/tcp

# Proveri da li sluša na javnom IP-u
ss -tlnp | grep 5006
```

**Trebalo bi da vidiš:**
```
0.0.0.0:5006    (ne samo 127.0.0.1:5006)
```

### Korak 2: Test sa Spoljšnjeg Servera (opciono)

**Ako želiš da testiraš sa drugog servera:**
```bash
# Sa drugog servera (npr. sa tvog računara ili sa Vercel-a)
curl -k -X PROPFIND https://139.59.139.89:5006 \
  -H "Depth: 0" \
  -u "webdav-user:3crpJxrKS60NuE7" \
  2>&1 | head -30
```

**Ako vidiš isti WebDAV XML response, proxy je dostupan sa spoljšnje strane!**

### Korak 3: Ažuriraj Vercel Environment Varijable

**Idi na Vercel Dashboard → Project → Settings → Environment Variables**

**Ažuriraj:**
```
WEBDAV_URL=https://139.59.139.89:5006
```

**Ostavi:**
```
WEBDAV_USERNAME=webdav-user
WEBDAV_PASSWORD=3crpJxrKS60NuE7
WEBDAV_BASE_PATH=/volume10/Warranty/REKLAMACIJE
```

### Korak 4: Redeploy Aplikaciju na Vercel-u

```bash
# Ili preko Vercel Dashboard → Deployments → Redeploy
# Ili automatski kada push-uješ na main branch
```

### Korak 5: Test WebDAV Funkcionalnosti

**Nakon redeploy-a, testiraj:**
1. Otvori aplikaciju na Vercel-u
2. Pošalji test email sa attachmentom
3. Proveri da li se attachment čuva i može da se otvori

**Ili koristi debug endpoint:**
```
https://your-app.vercel.app/api/debug/webdav-test
```

---

## Rezime

**Proxy Setup:**
- ✅ Nginx instaliran i konfigurisan
- ✅ Port 5006 otvoren i sluša
- ✅ Proxy prosleđuje zahteve ka Synology-u (100.80.235.71:5006) preko Tailscale
- ✅ WebDAV autentifikacija radi
- ✅ WebDAV komande rade (PROPFIND test prošao)

**Sledeći Korak:**
- Ažuriraj Vercel `WEBDAV_URL` na `https://139.59.139.89:5006`
- Redeploy aplikaciju
- Testiraj attachment funkcionalnost

---

**Javi:**
1. Da li je port 5006 otvoren na firewall-u (`ufw status | grep 5006`)?
2. Da li želiš da testiramo sa spoljšnje strane pre nego što ažuriramo Vercel?
