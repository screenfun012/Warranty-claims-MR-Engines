# WebDAV Path Guide - Kako da Postaviš Putanju

## 📍 Kako da Odabereš i Postaviš WebDAV Base Path

### Korak 1: Kreiraj Folder na Synology-u

Možeš kreirati folder **bilo gde** na Synology-u. Evo najčešćih opcija:

#### 🏠 Opcija 1: Home Direktorijum (Najjednostavnije)

**Lokacija:** `/home/mr-engines-warranty`

**Kako:**
1. Otvori **File Station**
2. Idi u `/home` folder
3. Klikni **Create** → **Create Folder**
4. Ime: `mr-engines-warranty`
5. Klikni **OK**

**WebDAV Base Path:** `/home/mr-engines-warranty`

**Prednosti:**
- ✅ Jednostavno za kreiranje
- ✅ Lako za pristup
- ✅ Automatski backup ako koristiš Home backup

---

#### 📦 Opcija 2: Shared Folder (Preporučeno za Produkciju)

**Lokacija:** `/volume1/mr-engines-warranty` (ili bilo koji volume)

**Kako:**
1. Otvori **File Station**
2. Idi u `/volume1` (ili tvoj glavni volume)
3. Klikni **Create** → **Create Folder**
4. Ime: `mr-engines-warranty` (ili bilo koje ime)
5. Klikni **OK**

**WebDAV Base Path:** `/volume1/mr-engines-warranty`

**Prednosti:**
- ✅ Više prostora
- ✅ Bolje performanse
- ✅ Možeš koristiti bilo koji volume

---

#### 🗂️ Opcija 3: Dedicirani Shared Folder

**Lokacija:** `/mr-engines-warranty` (kreiran kao shared folder)

**Kako:**
1. Idi u **Control Panel** → **Shared Folder**
2. Klikni **Create**
3. Ime: `mr-engines-warranty`
4. Izaberi volume
5. Klikni **Next** → **Next** → **Apply**

**WebDAV Base Path:** `/mr-engines-warranty`

**Prednosti:**
- ✅ Najbolje za produkciju
- ✅ Možeš da konfigurišeš quota, backup, itd.
- ✅ Lako upravljanje dozvolama

---

#### 💾 Opcija 4: Custom Volume (Ako Imaš Više Volume-a)

**Lokacija:** `/volume2/warranty-files` (prilagodi prema tvom volume-u)

**Kako:**
1. Otvori **File Station**
2. Idi u tvoj custom volume (npr. `/volume2`, `/volume3`)
3. Kreiraj folder sa bilo kojim imenom
4. Zabeleži tačnu putanju

**WebDAV Base Path:** `/volume2/warranty-files` (prilagodi)

**Prednosti:**
- ✅ Možeš da koristiš SSD volume za brže performanse
- ✅ Možeš da izoluješ podatke

---

### Korak 2: Dodeli Dozvole

**Nakon što kreiraš folder:**

1. Desni klik na folder → **Properties**
2. Idi na **Permissions** tab
3. Klikni **Edit**
4. Dodaj WebDAV korisnika (koji si kreirao ranije)
5. Dodeli **Read/Write** dozvole
6. Klikni **OK** → **Apply**

---

### Korak 3: Proveri Tačnu Putanju

**Kako da saznaš tačnu putanju:**

1. Otvori **File Station**
2. Desni klik na folder → **Properties**
3. Pogledaj **Location** - to je putanja koju treba da koristiš

**Primeri lokacija:**
- `/home/mr-engines-warranty`
- `/volume1/mr-engines-warranty`
- `/volume2/warranty-files`
- `/mr-engines-warranty` (ako je shared folder)

---

### Korak 4: Postavi u Aplikaciji

**U Vercel Dashboard** → **Settings** → **Environment Variables**:

```bash
WEBDAV_BASE_PATH=/home/mr-engines-warranty
```

**Zameni sa tvojom tačnom putanjom!**

---

## ✅ Provera

**Kako da proveriš da li radi:**

1. Postavi environment varijable na Vercel-u
2. Redeploy aplikaciju
3. Pošalji test email sa attachmentom
4. Proveri u **File Station** da li se fajl pojavio u folderu

---

## 🔍 Troubleshooting

### Problem: "Folder not found" ili "Permission denied"

**Rešenje:**
1. Proveri da li folder postoji u **File Station**
2. Proveri da li je putanja tačna (bez greške u imenu)
3. Proveri dozvole - WebDAV korisnik mora imati **Read/Write**
4. Proveri da li koristiš `/` na početku (npr. `/home/...` a ne `home/...`)

### Problem: Fajlovi se ne čuvaju

**Rešenje:**
1. Proveri `WEBDAV_BASE_PATH` - mora biti tačna putanja
2. Proveri da li WebDAV korisnik ima dozvole
3. Proveri logove u aplikaciji za greške

---

## 💡 Preporuke

1. **Za početak:** Koristi `/home/mr-engines-warranty` - najjednostavnije
2. **Za produkciju:** Kreiraj dedicirani shared folder u Control Panel-u
3. **Za performanse:** Koristi SSD volume ako imaš
4. **Za backup:** Omogući Hyper Backup za folder

---

**Napomena:** Folder može biti bilo gde na Synology-u - samo je važno da `WEBDAV_BASE_PATH` odgovara tačnoj putanji!
