# Final Testing Guide - Nakon Vercel Setup-a

## ✅ Šta je Urađeno

### 1. Code Changes
- ✅ Prisma problem popravljen (`getPrisma()` umesto `prisma`)
- ✅ WebDAV storage implementiran
- ✅ Email sync popravljen

### 2. Synology Setup
- ✅ MailPlus Server instaliran i konfigurisan
- ✅ Email nalog `claims@mrgroup.rs` kreiran i aktiviran
- ✅ WebDAV Server instaliran i konfigurisan
- ✅ Firewall portovi otvoreni (993, 465, 5006)
- ✅ Folder `/volume10/Warranty/REKLAMACIJE` kreiran sa dozvolama

### 3. Vercel Configuration
- ✅ Environment varijable dodate

---

## 🚀 Finalni Koraci

### Korak 1: Redeploy Aplikaciju

1. Idi u **Vercel Dashboard** → **Deployments**
2. Klikni na tri tačke (⋯) na poslednjem deployment-u
3. Klikni **Redeploy**
4. Sačekaj da se završi (može potrajati 2-5 minuta)

**Važno:** Redeploy je potreban da bi nove environment varijable bile aktivne!

---

## 🧪 Testiranje

### Test 1: Email Sync (Najvažnije!)

1. Otvori aplikaciju na Vercel-u
2. Uloguj se
3. Idi u **Inbox** stranicu
4. Pošalji test email na `claims@mrgroup.rs` sa drugog email naloga
5. U aplikaciji, klikni **Sync Now** (ili sačekaj automatski sync - 30 sekundi)
6. Proveri da li se email pojavio u Inbox-u

**Očekivani rezultat:**
- Email se pojavljuje u Inbox-u
- Attachmenti se čuvaju na Synology-u
- Nema grešaka u konzoli

---

### Test 2: File Storage (WebDAV)

1. Otvori claim koji ima attachment
2. Klikni na attachment da ga otvoriš
3. Proveri da li se fajl učitava

**Provera na Synology-u:**
1. Otvori **File Station** na Synology-u
2. Idi u `/volume10/Warranty/REKLAMACIJE`
3. Proveri da li se fajlovi čuvaju tamo

**Očekivani rezultat:**
- Fajlovi se učitavaju u aplikaciji
- Fajlovi se čuvaju na Synology-u u `/volume10/Warranty/REKLAMACIJE`

---

### Test 3: Mail Sync Problem (Prisma Fix)

1. Idi u **Inbox**
2. Klikni **Sync Now**
3. Proveri da li radi bez greške

**Očekivani rezultat:**
- Sync radi bez greške "Invalid `prisma.mailSyncState.findUnique()` invocation"
- Email se uspešno sync-uje

---

## 🐛 Troubleshooting

### Problem: Email sync ne radi

**Proveri:**
1. Vercel Dashboard → Functions → Logs
2. Proveri da li su sve email varijable dodate
3. Proveri da li su portovi otvoreni u firewall-u
4. Proveri email credentials

**Rešenje:**
- Proveri logove u Vercel-u za detaljne greške
- Proveri da li je email nalog aktiviran u MailPlus Server-u

---

### Problem: WebDAV ne radi

**Proveri:**
1. Vercel Dashboard → Functions → Logs
2. Proveri da li su sve WebDAV varijable dodate
3. Proveri da li je port 5006 otvoren u firewall-u
4. Testiraj WebDAV URL u browseru

**Rešenje:**
- Proveri `WEBDAV_BASE_PATH` - mora biti tačna putanja
- Proveri WebDAV credentials
- Proveri dozvole korisnika

---

### Problem: "Storage type not detected"

**Rešenje:**
- Proveri da li su WebDAV varijable dodate
- Proveri da li su sve tri varijable postavljene: `WEBDAV_URL`, `WEBDAV_USERNAME`, `WEBDAV_PASSWORD`
- Ako nisu sve tri, aplikacija će koristiti Vercel Blob ili filesystem

---

## ✅ Success Checklist

Kada sve radi, trebalo bi da vidiš:

- [ ] Email sync radi bez greške
- [ ] Novi emailovi se pojavljuju u Inbox-u
- [ ] Attachmenti se čuvaju na Synology-u
- [ ] Fajlovi se učitavaju iz Synology-a
- [ ] Nema grešaka u Vercel logovima
- [ ] Storage koristi WebDAV (ne Vercel Blob)

---

## 📊 Kako da Proveriš Storage Type

U Vercel Dashboard → Functions → Logs, traži:
- `"WebDAV client initialized"` - znači da koristi WebDAV
- `"Using Vercel Blob"` - znači da koristi Blob (ako nema WebDAV)

---

## 🎉 Kada je Sve Spremno

Ako svi testovi prolaze:
1. ✅ Email sync radi
2. ✅ Storage na Synology-u radi
3. ✅ Nema grešaka

**Čestitamo! Sve je spremno za produkciju! 🚀**

---

## 📝 Finalne Napomene

1. **Backup:** Razmotri Hyper Backup na Synology-u za backup podataka
2. **Monitoring:** Prati Vercel logove za greške
3. **Storage:** Sada imaš neograničen storage na Synology-u (koliko imaš prostora)
4. **Email:** Svi emailovi se čuvaju na Synology-u

---

**Srećno sa testiranjem!** 🎯
