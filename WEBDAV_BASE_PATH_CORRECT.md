# WebDAV Base Path - Ispravljeno! ✅

## Problem Rešen

✅ **Warranty folder je direktno na root-u: `/Warranty`**

**Prava putanja:** `/Warranty/REKLAMACIJE`

## Finalni Korak

### Korak 1: Test Prave Putanje

**Testiraj da li putanja `/Warranty/REKLAMACIJE` radi:**

```bash
# Na Droplet-u
curl -k -X PROPFIND "https://100.80.235.71:5006/Warranty/REKLAMACIJE" \
  -H "Depth: 0" \
  -u "webdav-user:3crpJxrKS60NuE7" \
  2>&1 | head -30
```

**Očekivani rezultat:** WebDAV XML response (200 OK) - ne 405 greška!

### Korak 2: Ažuriraj Vercel Environment Varijable

**Ako test prođe (vraća XML, ne 405):**

1. **Idi na Vercel Dashboard → Settings → Environment Variables**

2. **Ažuriraj `WEBDAV_BASE_PATH`:**
   ```
   WEBDAV_BASE_PATH=/Warranty/REKLAMACIJE
   ```

   **VAŽNO:**
   - ✅ Koristi `/Warranty/REKLAMACIJE` (ne `/volume10/Warranty/REKLAMACIJE`!)
   - ✅ Ne dodaj trailing slash!

3. **Ostale varijable ostaju iste:**
   ```
   WEBDAV_URL=https://139.59.139.89:5006
   WEBDAV_USERNAME=webdav-user
   WEBDAV_PASSWORD=3crpJxrKS60NuE7
   ```

### Korak 3: Redeploy Aplikaciju

**Nakon što ažuriraš environment varijable:**

1. **Vercel Dashboard → Deployments**
2. Klikni na **tri tačke (⋯)** na poslednjem deployment-u
3. Klikni **"Redeploy"**
4. Sačekaj da se završi (2-5 minuta)

### Korak 4: Test WebDAV Konekciju

**Nakon redeploy-a, testiraj:**

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
    "basePath": "/Warranty/REKLAMACIJE",
    "basePathExists": true,
    "directoryContents": 0,
    "testWriteRead": "successful"
  }
}
```

### Korak 5: Test Attachmente u Aplikaciji

**Nakon što WebDAV test prođe:**

1. Otvori aplikaciju na Vercel-u
2. Otvori postojeću reklamaciju (ako ima attachmenta)
3. Proveri attachmente u:
   - **Emails** tab
   - **Client Documents** tab
   - **Photos** tab

**Ili pošalji novi test email sa attachmentom i proveri da li se attachment čuva i može da se otvori.**

---

## Troubleshooting

### Problem: I dalje vidiš 405 grešku

**Ako i dalje vidiš 405 grešku nakon što ažuriraš putanju:**

1. Proveri da li folder `/Warranty/REKLAMACIJE` postoji na Synology-u
2. Proveri da li WebDAV korisnik ima pristup tom folderu
3. Proveri da li folder ima pravilna dozvola

### Problem: Folder ne postoji

**Ako folder `/Warranty/REKLAMACIJE` ne postoji:**

1. Kreiraj folder na Synology-u:
   - File Station → Warranty folder → Create Folder → REKLAMACIJE

2. Proveri da li WebDAV korisnik ima pristup:
   - Control Panel → User → webdav-user → Edit → Permissions
   - Proveri da li Warranty folder ima read/write pristup

---

**Javi rezultate:**
1. Da li test sa putanjom `/Warranty/REKLAMACIJE` radi (vraća XML, ne 405)?
2. Da li si ažurirao `WEBDAV_BASE_PATH` na Vercel-u?
3. Da li WebDAV test sada prolazi?
