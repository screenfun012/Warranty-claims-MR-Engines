# Synology WebDAV Path Issue Fix

## Problem Identifikovan

✅ **Lokalni test (kroz proxy) radi** - vraća WebDAV XML response (200 OK)
❌ **Direktni test (bez proxy-ja) ne radi** - vraća 405 Method Not Allowed
✅ **Nginx proxy radi pravilno** - prosleđuje PROPFIND metode

**Zaključak:** Nginx proxy radi dobro! Problem je u tome što Synology WebDAV server vraća 405 kada se pristupa direktno sa putanjom `/volume10/Warranty/REKLAMACIJE`.

**Ali:** Ako lokalni test kroz proxy radi, to znači da proxy prosleđuje zahteve pravilno, pa možda problem nije u putanji već u načinu kako WebDAV klijent sa Vercel-a šalje zahteve.

## Rešenje

### Opcija 1: Test Direktno bez Putanje

**Proveri da li direktni test radi bez putanje:**

```bash
# Na Droplet-u
curl -k -X PROPFIND https://100.80.235.71:5006/ \
  -H "Depth: 0" \
  -u "webdav-user:3crpJxrKS60NuE7" \
  2>&1 | head -30
```

**Ako radi bez putanje:** Problem je u putanji `/volume10/Warranty/REKLAMACIJE` - možda treba drugačija putanja.

### Opcija 2: Test sa PUTANJOM kroz Proxy

**Proveri da li test sa putanjom radi kroz proxy:**

```bash
# Na Droplet-u
curl -k -X PROPFIND https://localhost:5006/volume10/Warranty/REKLAMACIJE \
  -H "Depth: 0" \
  -u "webdav-user:3crpJxrKS60NuE7" \
  2>&1 | head -30
```

**Ako radi kroz proxy sa putanjom:** Problem je verovatno u načinu kako WebDAV klijent sa Vercel-a šalje zahteve.

### Opcija 3: Proveri WebDAV Putanju na Synology-u

**Možda je problem u tome što WebDAV base path nije pravilno podešen.**

**Proveri na Synology-u:**

1. **Control Panel → File Services → WebDAV**
   - Proveri da li je "Enable HTTPS WebDAV service" označeno
   - Proveri da li je port 5006 tačan
   - Proveri da li je WebDAV enabled za taj folder

2. **File Station**
   - Proveri da li folder `/volume10/Warranty/REKLAMACIJE` postoji
   - Proveri da li WebDAV korisnik ima pristup tom folderu

### Opcija 4: Ažuriraj WebDAV Base Path

**Možda treba koristiti drugačiju putanju za WebDAV.**

**Proveri na Synology-u koja je prava WebDAV putanja:**

- Možda je `/webdav/volume10/Warranty/REKLAMACIJE` umesto `/volume10/Warranty/REKLAMACIJE`
- Možda je `/volume10/Warranty/REKLAMACIJE/` (sa trailing slash)

**Testiraj različite putanje:**

```bash
# Na Droplet-u - test bez putanje
curl -k -X PROPFIND https://localhost:5006/ \
  -H "Depth: 0" \
  -u "webdav-user:3crpJxrKS60NuE7" \
  2>&1 | head -30

# Test sa trailing slash
curl -k -X PROPFIND https://localhost:5006/volume10/Warranty/REKLAMACIJE/ \
  -H "Depth: 0" \
  -u "webdav-user:3crpJxrKS60NuE7" \
  2>&1 | head -30
```

---

## Najverovatnije Rešenje

**Pošto lokalni test kroz proxy radi (vraća XML za `/`), ali direktni test ne radi, verovatno problem je u načinu kako WebDAV klijent sa Vercel-a šalje zahteve.**

**Možda WebDAV klijent koristi drugu putanju ili header-e koji Synology ne prihvata.**

**Hajde da testiramo sa pravom putanjom kroz proxy:**

```bash
# Na Droplet-u
curl -k -X PROPFIND https://localhost:5006/volume10/Warranty/REKLAMACIJE \
  -H "Depth: 0" \
  -u "webdav-user:3crpJxrKS60NuE7" \
  2>&1 | head -30
```

**Ako radi kroz proxy sa putanjom, onda problem nije u Nginx-u, već možda u načinu kako Vercel šalje zahteve (možda nedostaju header-i ili se putanja ne prosleđuje pravilno).**

---

**Javi rezultate:**
1. Da li direktni test bez putanje radi (`curl -k -X PROPFIND https://100.80.235.71:5006/`)?
2. Da li test sa putanjom kroz proxy radi (`curl -k -X PROPFIND https://localhost:5006/volume10/Warranty/REKLAMACIJE`)?
