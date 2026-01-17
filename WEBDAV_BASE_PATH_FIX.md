# WebDAV Base Path Fix - Koristi Shared Folder

## Problem Identifikovan

❌ **`WEBDAV_BASE_PATH=/volume10/Warranty/REKLAMACIJE` je pogrešan!**

**Na Synology WebDAV root-u postoje samo shared folders:**
- `/Deljeni dokumenti MR` (URL encoded: `/Deljeni%20dokumenti%20MR`)
- `/Dokumenti - Crnice` (URL encoded: `/Dokumenti%20-%20Crnice`)
- `/homes`

**Putanja `/volume10/Warranty/REKLAMACIJE` ne postoji na WebDAV root-u!**

**Rešenje:** Koristi shared folder putanju umesto direktne volume putanje.

## Rešenje

### Opcija 1: Koristi Postojeći Shared Folder

**Ako Warranty folder postoji u jednom od shared folders:**

1. **Proveri da li postoji `/Deljeni dokumenti MR/Warranty/REKLAMACIJE`:**

```bash
# Na Droplet-u
curl -k -X PROPFIND "https://100.80.235.71:5006/Deljeni%20dokumenti%20MR/Warranty/REKLAMACIJE" \
  -H "Depth: 0" \
  -u "webdav-user:3crpJxrKS60NuE7" \
  2>&1 | head -30
```

2. **Ili proveri `/Dokumenti - Crnice/Warranty/REKLAMACIJE`:**

```bash
# Na Droplet-u
curl -k -X PROPFIND "https://100.80.235.71:5006/Dokumenti%20-%20Crnice/Warranty/REKLAMACIJE" \
  -H "Depth: 0" \
  -u "webdav-user:3crpJxrKS60NuE7" \
  2>&1 | head -30
```

**Ako postoji u nekom od shared folders, ažuriraj `WEBDAV_BASE_PATH` na Vercel-u:**

```
WEBDAV_BASE_PATH=/Deljeni dokumenti MR/Warranty/REKLAMACIJE
```

**Ili:**

```
WEBDAV_BASE_PATH=/Dokumenti - Crnice/Warranty/REKLAMACIJE
```

### Opcija 2: Kreiraj Novi Shared Folder

**Ako Warranty folder ne postoji ni u jednom shared folder-u:**

1. **Kreiraj Warranty shared folder na Synology-u:**
   - Control Panel → Shared Folder → Create
   - Ime: `Warranty`
   - Location: `/volume10/Warranty`
   - Omogući WebDAV pristup

2. **Ažuriraj `WEBDAV_BASE_PATH` na Vercel-u:**

```
WEBDAV_BASE_PATH=/Warranty/REKLAMACIJE
```

### Opcija 3: Proveri Da Li REKLAMACIJE Postoji u Nekom od Shared Folders

**Proveri šta postoji u shared folders:**

```bash
# Na Droplet-u - proveri šta postoji u "Deljeni dokumenti MR"
curl -k -X PROPFIND "https://100.80.235.71:5006/Deljeni%20dokumenti%20MR" \
  -H "Depth: 1" \
  -u "webdav-user:3crpJxrKS60NuE7" \
  2>&1 | grep "href" | head -20

# Proveri šta postoji u "Dokumenti - Crnice"
curl -k -X PROPFIND "https://100.80.235.71:5006/Dokumenti%20-%20Crnice" \
  -H "Depth: 1" \
  -u "webdav-user:3crpJxrKS60NuE7" \
  2>&1 | grep "href" | head -20
```

**Ako REKLAMACIJE postoji u nekom od ovih folder-a, koristi tu putanju.**

---

## Ažuriranje Vercel Environment Varijabli

**Nakon što identifikuješ pravu putanju:**

1. **Idi na Vercel Dashboard → Settings → Environment Variables**

2. **Ažuriraj `WEBDAV_BASE_PATH`:**
   - Ako je u "Deljeni dokumenti MR": `/Deljeni dokumenti MR/Warranty/REKLAMACIJE`
   - Ako je u "Dokumenti - Crnice": `/Dokumenti - Crnice/Warranty/REKLAMACIJE`
   - Ako kreiraš novi shared folder: `/Warranty/REKLAMACIJE`

3. **Redeploy aplikaciju**

4. **Testiraj:**

```
https://your-app.vercel.app/api/debug/webdav-test
```

---

**Javi rezultate:**
1. Da li Warranty folder postoji u nekom od shared folders?
2. Koja je prava putanja za REKLAMACIJE folder?
