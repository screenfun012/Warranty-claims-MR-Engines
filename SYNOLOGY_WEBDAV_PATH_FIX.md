# Synology WebDAV Path Fix - 405 Method Not Allowed

## Problem Identifikovan

✅ **Test bez putanje radi** - direktno ka Synology-u vraća WebDAV XML (200 OK)
❌ **Test sa putanjom `/volume10/Warranty/REKLAMACIJE` ne radi** - vraća 405 Method Not Allowed
✅ **Nginx proxy radi pravilno** - prosleđuje PROPFIND metode

**Zaključak:** Problem je u putanji `/volume10/Warranty/REKLAMACIJE` - možda nije pravilna WebDAV putanja ili folder ne postoji.

## Rešenje

### Korak 1: Proveri Šta Postoji na Synology WebDAV

**Listaj root folder sa PROPFIND Depth 1:**

```bash
# Na Droplet-u
curl -k -X PROPFIND https://100.80.235.71:5006/ \
  -H "Depth: 1" \
  -u "webdav-user:3crpJxrKS60NuE7" \
  2>&1 | grep -A 5 "href"
```

**Ili:**

```bash
# Na Droplet-u - detaljnije
curl -k -X PROPFIND https://100.80.235.71:5006/ \
  -H "Depth: 1" \
  -u "webdav-user:3crpJxrKS60NuE7" \
  2>&1 | head -100
```

**Ovo će pokazati šta sve postoji na root WebDAV folderu.**

### Korak 2: Proveri Da Li Folder Postoji

**Možda folder nije pravilno podešen za WebDAV pristup.**

**Proveri na Synology-u:**

1. **File Station**
   - Proveri da li folder `/volume10/Warranty/REKLAMACIJE` postoji
   - Proveri da li WebDAV korisnik ima pristup tom folderu

2. **Control Panel → User → webdav-user**
   - Proveri da li korisnik ima pristup tom folderu
   - Proveri permissions (read/write)

3. **Control Panel → Shared Folder**
   - Proveri da li je folder "REKLAMACIJE" podešen kao shared folder
   - Proveri da li je omogućen pristup preko WebDAV

### Korak 3: Test Različite Putanje

**Možda je problem u putanji - možda treba koristiti drugačiju putanju za WebDAV.**

**Testiraj različite putanje:**

```bash
# Na Droplet-u - test bez /volume10 (možda je putanja drugačija)
curl -k -X PROPFIND https://100.80.235.71:5006/Warranty/REKLAMACIJE \
  -H "Depth: 0" \
  -u "webdav-user:3crpJxrKS60NuE7" \
  2>&1 | head -30

# Test sa webdav prefix (ako postoji)
curl -k -X PROPFIND https://100.80.235.71:5006/webdav/volume10/Warranty/REKLAMACIJE \
  -H "Depth: 0" \
  -u "webdav-user:3crpJxrKS60NuE7" \
  2>&1 | head -30
```

### Korak 4: Kreiraj Folder Ako Ne Postoji

**Možda folder ne postoji i treba ga kreirati.**

**Kreiraj folder koristeći MKCOL metodu:**

```bash
# Na Droplet-u - kreiraj folder rekurzivno
curl -k -X MKCOL https://100.80.235.71:5006/volume10 \
  -u "webdav-user:3crpJxrKS60NuE7" \
  2>&1 | head -10

curl -k -X MKCOL https://100.80.235.71:5006/volume10/Warranty \
  -u "webdav-user:3crpJxrKS60NuE7" \
  2>&1 | head -10

curl -k -X MKCOL https://100.80.235.71:5006/volume10/Warranty/REKLAMACIJE \
  -u "webdav-user:3crpJxrKS60NuE7" \
  2>&1 | head -10
```

**Ako vidiš 201 (Created) ili 405 (Method Not Allowed - folder već postoji), to je OK.**

### Korak 5: Proveri Pravi WebDAV Path

**Možda treba koristiti drugačiju putanju za WebDAV.**

**Na Synology-u, WebDAV putanje mogu biti:**
- `/volume10/Warranty/REKLAMACIJE` - direktna putanja
- `/webdav/volume10/Warranty/REKLAMACIJE` - sa webdav prefix
- `/Warranty/REKLAMACIJE` - bez volume10

**Hajde da proverim listu folder-a da vidim šta postoji.**

---

## Najverovatnije Rešenje

**Pošto test bez putanje radi, ali test sa putanjom ne radi, problem je verovatno u tome što:**

1. **Folder ne postoji** na WebDAV root-u - treba ga kreirati
2. **WebDAV putanja nije pravilna** - možda treba koristiti drugu putanju
3. **WebDAV korisnik nema pristup** tom folderu - treba proveriti permissions

**Hajde da prvo vidimo šta postoji na root-u, pa onda ažuriramo putanju.**

---

**Javi rezultate:**
1. Šta piše kada pokreneš `curl -k -X PROPFIND https://100.80.235.71:5006/ -H "Depth: 1"`?
2. Da li folder `/volume10/Warranty/REKLAMACIJE` postoji na Synology-u?
3. Da li WebDAV korisnik ima pristup tom folderu?
