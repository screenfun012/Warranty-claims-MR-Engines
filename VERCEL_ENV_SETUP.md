# Vercel Environment Variables Setup

## 📋 Finalna Checklist - Pre Dodavanja na Vercel

### ✅ Synology Setup - Proveri da je sve urađeno:

- [ ] **MailPlus Server** - instaliran ✓
- [ ] **Email nalog** - kreiran i aktiviran (`claims@mrgroup.rs`) ✓
- [ ] **IMAP/SMTP** - omogućeni (portovi 993 i 465) ✓
- [ ] **Firewall** - portovi otvoreni (993, 465, 5006) ✓
- [ ] **WebDAV Server** - instaliran ✓
- [ ] **WebDAV korisnik** - kreiran sa dozvolama ✓
- [ ] **WebDAV folder** - kreiran (`/volume10/Warranty/REKLAMACIJE`) ✓
- [ ] **WebDAV dozvole** - Read/Write dodeljene ✓

---

## 🔐 Environment Varijable za Vercel

### Korak 1: Idi u Vercel Dashboard

1. Otvori [Vercel Dashboard](https://vercel.com/dashboard)
2. Izaberi tvoj projekat (`mr-engines-warranty`)
3. Idi u **Settings** → **Environment Variables**

---

### Korak 2: Dodaj Email Varijable

Klikni **Add New** i dodaj svaku varijablu:

#### Email - IMAP (Primanje)
```
Key: IMAP_SERVER
Value: 192-168-100-226.mrengines.direct.quickconnect.to
Environment: Production, Preview, Development (sve tri)
```

```
Key: IMAP_PORT
Value: 993
Environment: Production, Preview, Development
```

```
Key: IMAP_USER_EMAIL
Value: claims@mrgroup.rs
Environment: Production, Preview, Development
```

```
Key: IMAP_USER_PASS
Value: tvoja-lozinka-za-korisnika-claims
Environment: Production, Preview, Development
```

```
Key: IMAP_TLS
Value: true
Environment: Production, Preview, Development
```

#### Email - SMTP (Slanje)
```
Key: SMTP_SERVER
Value: 192-168-100-226.mrengines.direct.quickconnect.to
Environment: Production, Preview, Development
```

```
Key: SMTP_PORT
Value: 465
Environment: Production, Preview, Development
```

```
Key: SMTP_USER_EMAIL
Value: claims@mrgroup.rs
Environment: Production, Preview, Development
```

```
Key: SMTP_USER_PASS
Value: ista-lozinka-kao-IMAP_USER_PASS
Environment: Production, Preview, Development
```

```
Key: SMTP_TLS
Value: true
Environment: Production, Preview, Development
```

---

### Korak 3: Dodaj WebDAV Varijable

```
Key: WEBDAV_URL
Value: https://192-168-100-226.mrengines.direct.quickconnect.to:5006/webdav
Environment: Production, Preview, Development
```

```
Key: WEBDAV_USERNAME
Value: webdav-user
Environment: Production, Preview, Development
```

```
Key: WEBDAV_PASSWORD
Value: tvoja-webdav-lozinka
Environment: Production, Preview, Development
```

```
Key: WEBDAV_BASE_PATH
Value: /volume10/Warranty/REKLAMACIJE
Environment: Production, Preview, Development
```

---

### Korak 4: Proveri Postojeće Varijable

Proveri da li već imaš ove varijable (ne menjaj ih ako postoje):
- `DATABASE_URL`
- `AUTH0_*` varijable
- `BLOB_READ_WRITE_TOKEN` (možeš ostaviti ili obrisati - WebDAV će imati prioritet)

---

### Korak 5: Redeploy Aplikaciju

1. Nakon dodavanja svih varijabli, idi u **Deployments** tab
2. Klikni na tri tačke (⋯) na poslednjem deployment-u
3. Klikni **Redeploy**
4. Sačekaj da se završi

---

## ✅ Testiranje

### Test 1: Email Sync

1. Otvori aplikaciju
2. Idi u **Inbox**
3. Pošalji test email na `claims@mrgroup.rs` sa drugog email naloga
4. Klikni **Sync Now** (ili sačekaj automatski sync)
5. Proveri da li se email pojavio

### Test 2: File Storage

1. Otvori claim sa attachmentom
2. Proveri da li se fajl učitava
3. Proveri u **File Station** na Synology-u da li se fajl nalazi u `/volume10/Warranty/REKLAMACIJE`

---

## 🐛 Troubleshooting

### Problem: Email sync ne radi

**Rešenje:**
1. Proveri da li su sve email varijable dodate na Vercel-u
2. Proveri da li su portovi 993 i 465 otvoreni u firewall-u
3. Proveri email credentials
4. Proveri logove u Vercel Dashboard → Functions → Logs

### Problem: WebDAV ne radi

**Rešenje:**
1. Proveri da li su sve WebDAV varijable dodate
2. Proveri da li je port 5006 otvoren u firewall-u
3. Proveri WebDAV credentials
4. Proveri da li folder `/volume10/Warranty/REKLAMACIJE` postoji
5. Proveri dozvole WebDAV korisnika

### Problem: "Invalid credentials"

**Rešenje:**
1. Proveri da li su lozinke tačne (bez razmaka)
2. Proveri da li je email nalog aktiviran u MailPlus Server-u
3. Proveri da li WebDAV korisnik ima dozvole

---

## 📝 Finalna Lista Varijabli

Evo kompletnog spiska varijabli koje treba da dodaš:

```bash
# Email - IMAP
IMAP_SERVER=192-168-100-226.mrengines.direct.quickconnect.to
IMAP_PORT=993
IMAP_USER_EMAIL=claims@mrgroup.rs
IMAP_USER_PASS=***
IMAP_TLS=true

# Email - SMTP
SMTP_SERVER=192-168-100-226.mrengines.direct.quickconnect.to
SMTP_PORT=465
SMTP_USER_EMAIL=claims@mrgroup.rs
SMTP_USER_PASS=***
SMTP_TLS=true

# WebDAV Storage
WEBDAV_URL=https://192-168-100-226.mrengines.direct.quickconnect.to:5006/webdav
WEBDAV_USERNAME=webdav-user
WEBDAV_PASSWORD=***
WEBDAV_BASE_PATH=/volume10/Warranty/REKLAMACIJE
```

---

**Napomena:** Zameni `***` sa stvarnim lozinkama!
