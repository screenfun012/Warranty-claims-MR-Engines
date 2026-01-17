# DuckDNS → Vercel Update Checklist

## ✅ DuckDNS Setup Završen

- [x] DuckDNS domain kreiran: `mr-engines.duckdns.org`
- [x] Custom provider konfigurisan na Synology-u
- [x] Status: "Normal" ✓

## 📝 Sledeći Koraci

### 1. Test u Browser-u (OPTIONAL - ali preporučeno)

Otvori: `https://mr-engines.duckdns.org:5006`

**Očekivani rezultat:**
- Povezuje se na Synology (može potrajati 10-30 sekundi)
- Traži korisničko ime i lozinku (WebDAV credentials)
- Ili prikaže upozorenje o self-signed sertifikatu (to je OK)

### 2. Update Vercel Environment Variables

**Vercel Dashboard → Settings → Environment Variables:**

Ažuriraj `WEBDAV_URL`:
```
WEBDAV_URL=https://mr-engines.duckdns.org:5006
```

**VAŽNO:**
- ✅ Koristi HTTPS (`https://`)
- ✅ Koristi port `5006`
- ❌ Ne dodaj `/webdav` na kraju!

**Proveri da su i ostale varijable postavljene:**
- ✅ `WEBDAV_USERNAME` - WebDAV korisničko ime
- ✅ `WEBDAV_PASSWORD` - WebDAV lozinka
- ✅ `WEBDAV_BASE_PATH` - `/volume10/Warranty/REKLAMACIJE`

### 3. Redeploy Aplikaciju

1. **Vercel Dashboard → Deployments**
2. Klikni na **tri tačke (⋯)** na poslednjem deployment-u
3. Klikni **"Redeploy"**
4. Sačekaj da se završi (2-5 minuta)

**Provera:**
- Build logovi treba da budu zeleni (bez grešaka)
- Deployment status: "Ready"

### 4. Test WebDAV Connection

Otvori: `https://your-app.vercel.app/api/debug/webdav-test`

**Očekivani rezultat:**
```json
{
  "success": true,
  "message": "WebDAV connection successful!",
  "details": {
    "url": "https://mr-engines.duckdns.org:5006",
    "basePath": "/volume10/Warranty/REKLAMACIJE",
    "basePathExists": true,
    "testWriteRead": "successful"
  }
}
```

**Ako vidiš grešku:**
- Proveri da li je firewall otvoren za port 5006
- Proveri da li WebDAV server radi na Synology-u
- Proveri Vercel Runtime Logs za detalje

### 5. Test Attachmente u Aplikaciji

1. Otvori postojeću reklamaciju
2. Proveri attachmente u:
   - **Emails** tab
   - **Client Documents** tab
   - **Photos** tab
3. Klikni na attachment - trebalo bi da se otvara!

**Ako attachmente ne rade:**
- Proveri browser konzolu (F12) za greške
- Proveri Vercel Runtime Logs za `[readAttachmentFile]` greške
- Javi rezultate!

## ✅ Final Checklist

- [ ] DuckDNS status "Normal" na Synology-u ✓
- [ ] Browser test: `https://mr-engines.duckdns.org:5006` radi
- [ ] Vercel `WEBDAV_URL` ažuriran
- [ ] Aplikacija redeploy-ovana
- [ ] `/api/debug/webdav-test` vraća `"success": true`
- [ ] Attachmente rade u aplikaciji
