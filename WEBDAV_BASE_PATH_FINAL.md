# WebDAV Base Path - Final Fix

## Problem

✅ **Warranty folder postoji i u njemu je REKLAMACIJE folder**

**Potrebno je pronaći pravu putanju za WebDAV.**

## Rešenje

### Korak 1: Pronađi U Kom Shared Folder-u je Warranty

**Proveri da li je Warranty u "Deljeni dokumenti MR":**

```bash
# Na Droplet-u
curl -k -X PROPFIND "https://100.80.235.71:5006/Deljeni%20dokumenti%20MR" \
  -H "Depth: 1" \
  -u "webdav-user:3crpJxrKS60NuE7" \
  2>&1 | grep -i warranty
```

**Proveri da li je Warranty u "Dokumenti - Crnice":**

```bash
# Na Droplet-u
curl -k -X PROPFIND "https://100.80.235.71:5006/Dokumenti%20-%20Crnice" \
  -H "Depth: 1" \
  -u "webdav-user:3crpJxrKS60NuE7" \
  2>&1 | grep -i warranty
```

### Korak 2: Test Prave Putanje

**Nakon što pronađeš gde je Warranty, testiraj direktno:**

**Ako je u "Deljeni dokumenti MR":**
```bash
# Na Droplet-u
curl -k -X PROPFIND "https://100.80.235.71:5006/Deljeni%20dokumenti%20MR/Warranty/REKLAMACIJE" \
  -H "Depth: 0" \
  -u "webdav-user:3crpJxrKS60NuE7" \
  2>&1 | head -30
```

**Ako je u "Dokumenti - Crnice":**
```bash
# Na Droplet-u
curl -k -X PROPFIND "https://100.80.235.71:5006/Dokumenti%20-%20Crnice/Warranty/REKLAMACIJE" \
  -H "Depth: 0" \
  -u "webdav-user:3crpJxrKS60NuE7" \
  2>&1 | head -30
```

**Ako Warranty direktno na root-u (ako je shared folder):**
```bash
# Na Droplet-u
curl -k -X PROPFIND "https://100.80.235.71:5006/Warranty/REKLAMACIJE" \
  -H "Depth: 0" \
  -u "webdav-user:3crpJxrKS60NuE7" \
  2>&1 | head -30
```

### Korak 3: Ažuriraj Vercel Environment Varijable

**Nakon što testiraš i potvrdiš da putanja radi, ažuriraj na Vercel-u:**

1. **Vercel Dashboard → Settings → Environment Variables**

2. **Ažuriraj `WEBDAV_BASE_PATH`:**
   - Ako je `/Deljeni dokumenti MR/Warranty/REKLAMACIJE`: `WEBDAV_BASE_PATH=/Deljeni dokumenti MR/Warranty/REKLAMACIJE`
   - Ako je `/Dokumenti - Crnice/Warranty/REKLAMACIJE`: `WEBDAV_BASE_PATH=/Dokumenti - Crnice/Warranty/REKLAMACIJE`
   - Ako je `/Warranty/REKLAMACIJE`: `WEBDAV_BASE_PATH=/Warranty/REKLAMACIJE`

3. **Redeploy aplikaciju**

4. **Testiraj:**

```
https://your-app.vercel.app/api/debug/webdav-test
```

---

**Javi:**
1. U kom shared folder-u je Warranty?
2. Da li test sa pravom putanjom radi (vraća WebDAV XML umesto 405)?
