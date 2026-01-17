# WebDAV Proxy - Finalni Korak: Ažuriranje Vercel 🚀

## Status

✅ **Nginx proxy radi lokalno na Droplet-u!**
✅ **Port 5006 sluša na javnom IP-u (`0.0.0.0:5006`)**
✅ **WebDAV PROPFIND test prošao (HTTP 200 OK)**
✅ **Proxy prosleđuje zahteve ka Synology-u preko Tailscale**

## Finalni Korak: Ažuriranje Vercel Environment Varijabli

### Korak 1: Otvori Vercel Dashboard

1. Idite na [vercel.com](https://vercel.com) i ulogujte se
2. Kliknite na vaš projekat (`mr-engines-warranty` ili slično)
3. Idite na **"Settings"** → **"Environment Variables"**

### Korak 2: Ažuriraj WEBDAV_URL

**Pronađi `WEBDAV_URL` i ažuriraj ga:**

```
WEBDAV_URL=https://139.59.139.89:5006
```

**VAŽNO:**
- ✅ Koristi HTTPS (`https://`)
- ✅ Koristi IP adresu Droplet-a (`139.59.139.89`)
- ✅ Koristi port `5006`
- ❌ Ne dodaj `/webdav` na kraju!
- ❌ Ne koristi direktni Synology URL (QuickConnect, DuckDNS, itd.)

### Korak 3: Proveri Ostale WebDAV Varijable

**Proveri da su i ostale varijable postavljene:**

```
WEBDAV_USERNAME=webdav-user
WEBDAV_PASSWORD=3crpJxrKS60NuE7
WEBDAV_BASE_PATH=/volume10/Warranty/REKLAMACIJE
```

**Ostavi ove varijable kao što jesu** - ne menjaj ih!

### Korak 4: Redeploy Aplikaciju

**Nakon što ažuriraš environment varijable:**

1. **Vercel Dashboard → Deployments**
2. Klikni na **tri tačke (⋯)** na poslednjem deployment-u
3. Klikni **"Redeploy"**
4. Sačekaj da se završi (2-5 minuta)

**Provera:**
- Build logovi treba da budu zeleni (bez grešaka)
- Deployment status: "Ready"

### Korak 5: Test WebDAV Connection

**Nakon redeploy-a, testiraj WebDAV konekciju:**

**Otvori u browser-u:**
```
https://your-app.vercel.app/api/debug/webdav-test
```

**Očekivani rezultat:**
```json
{
  "success": true,
  "message": "WebDAV connection successful!",
  "details": {
    "url": "https://139.59.139.89:5006",
    "basePath": "/volume10/Warranty/REKLAMACIJE",
    "basePathExists": true,
    "testWriteRead": "successful",
    "directoryContents": 0
  }
}
```

**Ako vidiš `"success": true`, WebDAV proxy radi sa Vercel-a!**

### Korak 6: Test Attachmente u Aplikaciji

**Nakon što WebDAV test prođe:**

1. Otvori aplikaciju na Vercel-u
2. Otvori postojeću reklamaciju (ako ima attachmenta)
3. Proveri attachmente u:
   - **Emails** tab
   - **Client Documents** tab
   - **Photos** tab

**Ili:**
1. Pošalji test email sa attachmentom aplikaciji
2. Proveri da li se attachment čuva i može da se otvori

---

## Troubleshooting

### Problem: "ETIMEDOUT" ili "Connection timeout"

**Uzrok:** DigitalOcean firewall blokira port 5006.

**Rešenje:**
1. Proveri DigitalOcean Dashboard → Networking → Firewalls
2. Proveri da li postoji firewall grupa i da li dozvoljava port 5006
3. Ako ne postoji firewall grupa, port bi trebalo da bude dostupan

### Problem: "401 Unauthorized"

**Uzrok:** WebDAV credentials nisu ispravni.

**Rešenje:**
1. Proveri da su `WEBDAV_USERNAME` i `WEBDAV_PASSWORD` ispravni
2. Testiraj credentials lokalno na Droplet-u:
   ```bash
   curl -k -X PROPFIND https://localhost:5006 \
     -H "Depth: 0" \
     -u "webdav-user:3crpJxrKS60NuE7"
   ```

### Problem: "404 Not Found"

**Uzrok:** `WEBDAV_BASE_PATH` nije ispravan.

**Rešenje:**
1. Proveri da je `WEBDAV_BASE_PATH` postavljen na `/volume10/Warranty/REKLAMACIJE`
2. Proveri da folder postoji na Synology-u

### Problem: Attachmente se ne prikazuju

**Uzrok:** Attachmente možda nisu bili sačuvani na WebDAV-u (bili su na filesystem-u).

**Rešenje:**
1. Pošalji novi test email sa attachmentom
2. Proveri da li se novi attachment čuva i prikazuje
3. Stari attachmenti koji su sačuvani na filesystem-u neće biti dostupni (Vercel serverless ne čuva fajlove)

---

## Rezime

**Proxy Setup:**
- ✅ Nginx instaliran i konfigurisan
- ✅ Port 5006 otvoren i sluša na javnom IP-u
- ✅ Proxy prosleđuje zahteve ka Synology-u (100.80.235.71:5006) preko Tailscale
- ✅ WebDAV autentifikacija radi
- ✅ WebDAV komande rade (PROPFIND test prošao)

**Sledeći Korak:**
- Ažuriraj Vercel `WEBDAV_URL` na `https://139.59.139.89:5006`
- Redeploy aplikaciju
- Testiraj WebDAV konekciju i attachment funkcionalnost

---

**Javi mi kada ažuriraš Vercel i redeploy-uješ aplikaciju!** 🎉
