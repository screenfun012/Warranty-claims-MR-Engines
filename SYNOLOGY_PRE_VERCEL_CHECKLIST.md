# Synology Pre-Vercel Checklist

Proveri sve ovo **pre nego što** dodaš environment varijable na Vercel-u.

## ✅ Checklist

### 1. WebDAV Server Setup

- [ ] **WebDAV Server je instaliran**
  - Package Center → WebDAV Server → Install
  
- [ ] **HTTPS WebDAV je omogućen**
  - WebDAV Server → Settings
  - Port 5006 (HTTPS) - omogućen ✓
  - Port 5005 (HTTP) - opciono

- [ ] **WebDAV korisnik je kreiran**
  - Control Panel → User → Create
  - Username: `webdav-user` (ili bilo koje ime)
  - Password: zabeležena ✓

- [ ] **WebDAV korisnik ima dozvole za aplikaciju**
  - User → Edit → Application permissions
  - WebDAV Server → Allow ✓

- [ ] **Folder dozvole su dodeljene**
  - File Station → Warranty → REKLAMACIJE
  - Properties → Permissions → Edit
  - WebDAV korisnik → Read ✓ Write ✓

- [ ] **WebDAV pristup je testiran**
  - Browser: `https://192-168-100-226.mrengines.direct.quickconnect.to:5006/webdav`
  - Treba da traži korisničko ime i lozinku ✓
  - Ili File Station → Tools → Mount Remote Drive → WebDAV

---

### 2. MailPlus Server Setup (za email)

- [ ] **MailPlus Server je instaliran**
  - Package Center → Synology MailPlus Server → Install

- [ ] **Email nalog je kreiran**
  - MailPlus Server → Users → Create
  - Email: `claims@mrgroup` (ili tvoj domen)
  - Password: zabeležena ✓

- [ ] **IMAP je omogućen**
  - MailPlus Server → Settings → IMAP
  - Port 993 (TLS/SSL) - omogućen ✓

- [ ] **SMTP je omogućen**
  - MailPlus Server → Settings → SMTP
  - Port 465 (TLS/SSL) ili 587 (STARTTLS) - omogućen ✓

- [ ] **Email pristup je testiran**
  - Email klijent (Outlook, Thunderbird) ili
  - Direktno u aplikaciji nakon Vercel setup-a

---

### 3. Firewall Podešavanja

- [ ] **Port 5006 (HTTPS WebDAV) je otvoren**
  - Control Panel → Security → Firewall
  - Dodaj pravilo za port 5006 → Allow

- [ ] **Port 993 (IMAP) je otvoren**
  - Firewall → Dodaj pravilo za port 993 → Allow

- [ ] **Port 465 (SMTP) je otvoren**
  - Firewall → Dodaj pravilo za port 465 → Allow

- [ ] **Port 587 (SMTP STARTTLS) je otvoren** (ako koristiš)
  - Firewall → Dodaj pravilo za port 587 → Allow

---

### 4. QuickConnect / DDNS

- [ ] **QuickConnect ID je poznat**
  - Control Panel → QuickConnect
  - QuickConnect ID: `MRengines` (ili tvoj)
  - Full URL: `192-168-100-226.mrengines.direct.quickconnect.to`

- [ ] **QuickConnect je omogućen**
  - QuickConnect → Enable ✓

---

### 5. Finalna Provera

- [ ] **WebDAV URL radi**
  - Test: `https://192-168-100-226.mrengines.direct.quickconnect.to:5006/webdav`
  - Treba da traži korisničko ime i lozinku

- [ ] **Folder putanja je tačna**
  - File Station → Warranty → REKLAMACIJE
  - Properties → Location: `/volume10/Warranty/REKLAMACIJE`
  - Zabeleži tačnu putanju ✓

- [ ] **Sve lozinke su zabeležene**
  - WebDAV korisnik lozinka ✓
  - Email lozinka (`claims@mrgroup`) ✓

---

## 📝 Zabeleži Ove Vrednosti

Pre nego što pređeš na Vercel, zabeleži:

### WebDAV:
```
WEBDAV_URL=https://192-168-100-226.mrengines.direct.quickconnect.to:5006/webdav
WEBDAV_USERNAME=webdav-user
WEBDAV_PASSWORD=________________
WEBDAV_BASE_PATH=/volume10/Warranty/REKLAMACIJE
```

### Email:
```
IMAP_SERVER=192-168-100-226.mrengines.direct.quickconnect.to
IMAP_PORT=993
IMAP_USER_EMAIL=claims@mrgroup
IMAP_USER_PASS=________________
IMAP_TLS=true

SMTP_SERVER=192-168-100-226.mrengines.direct.quickconnect.to
SMTP_PORT=465
SMTP_USER_EMAIL=claims@mrgroup
SMTP_USER_PASS=________________
SMTP_TLS=true
```

---

## ✅ Kada je Sve Spremno

Kada proveriš sve iznad, možeš da:
1. Dodaš environment varijable na Vercel-u
2. Redeploy aplikaciju
3. Testiraš da li radi

---

## 🐛 Troubleshooting

### Problem: WebDAV ne radi
- Proveri da li je port 5006 otvoren u firewall-u
- Proveri da li je HTTPS WebDAV omogućen
- Proveri dozvole korisnika

### Problem: Email ne radi
- Proveri da li su portovi 993 i 465 otvoreni
- Proveri da li je IMAP/SMTP omogućen u MailPlus Server
- Proveri email credentials

### Problem: QuickConnect ne radi
- Proveri da li je QuickConnect omogućen
- Proveri da li je QuickConnect ID tačan
- Proveri mrežnu konekciju
