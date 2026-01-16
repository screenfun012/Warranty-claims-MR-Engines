# Synology MailPlus Server Setup - Korak po Korak

## 📧 Faza 1: Instaliraj MailPlus Server

### Korak 1.1: Instalacija

1. Otvori **Package Center** na Synology NAS-u
2. U pretrazi unesi: `MailPlus Server`
3. Pronađi **Synology MailPlus Server**
4. Klikni **Install**
5. Sačekaj da se instalacija završi (može potrajati nekoliko minuta)

---

## 🔧 Faza 2: Konfiguriši Domain

### Korak 2.1: Proveri Domain Settings

1. Idi u **Control Panel** → **Domain/LDAP**
2. Proveri da li imaš konfigurisan domen
3. Ako nemaš, možeš koristiti:
   - **QuickConnect ID** (već imaš: `192-168-100-226.mrengines.direct.quickconnect.to`)
   - Ili kreiraj novi domen u Domain/LDAP

**Napomena:** Za email, preporučeno je da imaš pravi domen (npr. `mrgroup.rs`), ali možeš koristiti i QuickConnect za testiranje.

---

## 👤 Faza 3: Kreiraj Email Nalog

### Korak 3.1: Otvori MailPlus Server

1. Otvori **MailPlus Server** (iz Package Center-a)
2. Idi u **Users** tab

### Korak 3.2: Kreiraj Email Nalog

1. Klikni **Create**
2. Unesi:
   - **Email address**: `claims@mrgroup` (ili `claims@tvoj-domen.rs`)
   - **Password**: jaka lozinka (zabeleži je!)
   - **Mailbox quota**: po potrebi (npr. 10GB)
3. Klikni **Next**

### Korak 3.3: Dodeli Dozvole

1. **Application permissions**: 
   - Možeš ostaviti default dozvole
   - Ili omogući samo potrebne aplikacije
2. Klikni **Next** → **Next** → **Create**

---

## ⚙️ Faza 4: Konfiguriši IMAP/SMTP Portove

### Korak 4.1: IMAP Podešavanja

1. U **MailPlus Server** → **Settings** → **IMAP**
2. Proveri/omogući:
   - **Enable IMAP service**: ✓
   - **IMAP port**: `993` (TLS/SSL)
   - **Enable TLS/SSL**: ✓
3. Klikni **Apply**

### Korak 4.2: SMTP Podešavanja

1. U **MailPlus Server** → **Settings** → **SMTP**
2. Proveri/omogući:
   - **Enable SMTP service**: ✓
   - **SMTP port**: `465` (TLS/SSL) ili `587` (STARTTLS)
   - **Enable TLS/SSL**: ✓ (za port 465)
   - **Enable STARTTLS**: ✓ (za port 587)
3. Klikni **Apply**

**Preporuka:** Koristi port **465** za SMTP (TLS/SSL) - jednostavnije.

---

## 🔥 Faza 5: Firewall Podešavanja

### Korak 5.1: Otvori Portove

1. Idi u **Control Panel** → **Security** → **Firewall**
2. Klikni **Edit Rules** ili **Create**
3. Dodaj pravila:

#### Pravilo 1: IMAP (Port 993)
- **Port**: `993`
- **Protocol**: TCP
- **Action**: Allow
- **Source IP**: All (ili specificiraj ako želiš)

#### Pravilo 2: SMTP (Port 465)
- **Port**: `465`
- **Protocol**: TCP
- **Action**: Allow
- **Source IP**: All (ili specificiraj ako želiš)

#### Pravilo 3: SMTP STARTTLS (Port 587) - Opciono
- **Port**: `587`
- **Protocol**: TCP
- **Action**: Allow
- **Source IP**: All

4. Klikni **Apply** za svako pravilo

---

## ✅ Faza 6: Testiranje

### Korak 6.1: Test Email Klijentom

Možeš testirati preko email klijenta (Outlook, Thunderbird, Apple Mail):

**IMAP Settings:**
- Server: `192-168-100-226.mrengines.direct.quickconnect.to`
- Port: `993`
- Security: SSL/TLS
- Username: `claims@mrgroup`
- Password: tvoja lozinka

**SMTP Settings:**
- Server: `192-168-100-226.mrengines.direct.quickconnect.to`
- Port: `465`
- Security: SSL/TLS
- Username: `claims@mrgroup`
- Password: tvoja lozinka

### Korak 6.2: Test Slanja/Primanja

1. Pošalji test email sa drugog email naloga na `claims@mrgroup`
2. Proveri da li se email primio
3. Odgovori na email da testiraš SMTP

---

## 📝 Faza 7: Zabeleži Konfiguraciju

Zabeleži ove vrednosti za Vercel:

```bash
# Email Konfiguracija
IMAP_SERVER=192-168-100-226.mrengines.direct.quickconnect.to
IMAP_PORT=993
IMAP_USER_EMAIL=claims@mrgroup
IMAP_USER_PASS=________________ (tvoja lozinka)
IMAP_TLS=true

SMTP_SERVER=192-168-100-226.mrengines.direct.quickconnect.to
SMTP_PORT=465
SMTP_USER_EMAIL=claims@mrgroup
SMTP_USER_PASS=________________ (ista lozinka)
SMTP_TLS=true
```

---

## 🐛 Troubleshooting

### Problem: Email se ne prima

**Rešenje:**
1. Proveri da li je IMAP omogućen u MailPlus Server
2. Proveri da li je port 993 otvoren u firewall-u
3. Proveri email credentials
4. Proveri da li email nalog postoji u MailPlus Server

### Problem: Email se ne šalje

**Rešenje:**
1. Proveri da li je SMTP omogućen u MailPlus Server
2. Proveri da li je port 465 otvoren u firewall-u
3. Proveri SMTP credentials
4. Proveri da li postoji SMTP relay ograničenje

### Problem: QuickConnect ne radi za email

**Rešenje:**
- QuickConnect može imati problema sa email portovima
- Razmotri korišćenje DDNS ili statične IP adrese
- Ili koristi lokalnu IP za testiranje

---

## ✅ Kada je Sve Spremno

Kada proveriš sve iznad:
1. Email nalog je kreiran ✓
2. IMAP/SMTP su omogućeni ✓
3. Portovi su otvoreni u firewall-u ✓
4. Email radi (testirao si) ✓

Tada možeš da dodaš environment varijable na Vercel-u!
