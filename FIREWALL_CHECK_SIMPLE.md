# Firewall Check - Korak po Korak

## Problem

DDNS status je "Normal" (svi provajderi rade), ali browser ne može da pristupi portu 5006.

**Uzrok:** Verovatno firewall na Synology-u blokira port 5006.

## Provera Firewall Korak po Korak

### Korak 1: Otvori Firewall Settings

1. **Synology DSM → Control Panel → Security → Firewall**
2. Proveri da li piše: **"Firewall: Enabled"** ili **"Firewall: Disabled"**

### Korak 2A: Ako je Firewall **DISABLED** (isključen)

- **Problem:** Firewall nije uzrok
- **Sledeći korak:** Proveri WebDAV server status

### Korak 2B: Ako je Firewall **ENABLED** (uključen)

**Ovo je verovatno problem!** Nastavi dalje:

1. Klikni na **"Firewall Profile"** (gore u meniju)
2. Klikni **"Edit Rules"** ili **"Configure"**

### Korak 3: Proveri Pravila za Port 5006

U "Edit Rules" dialog-u, vidi listu pravila.

**Traži pravilo koje ima:**
- Port: `5006`
- Protocol: `TCP`
- Action: `Allow`

**Ako NE postoji pravilo za port 5006:**
- To je problem! Dodaj pravilo (vidi Korak 4)

**Ako POSTOJI pravilo za port 5006:**
- Proveri da li je Action: **Allow** (ne Deny!)
- Proveri da li je Source IP: **All** (ili ostavljeno prazno)
- Proveri da li je pravilo **omogućeno** (check mark)

### Korak 4: Dodaj Firewall Pravilo (ako ne postoji)

1. U "Edit Rules" dialog-u, klikni **"Create"** ili **"Add"**
2. Popuni formu:
   - **Action:** Allow (izaberi iz dropdown-a)
   - **Protocol:** TCP (izaberi iz dropdown-a)
   - **Port:** `5006` (unesi u polje)
   - **Source IP:** Ostavi PRAZNO ili izaberi "All"
   - **Destination IP:** Ostavi PRAZNO ili izaberi "All"
3. Klikni **"OK"**
4. Klikni **"Apply"** (na dnu stranice ili u dialog-u)

**Napomena:** Možda treba da klikneš "Apply" i van dialog-a - proveri da li ima "Apply" dugme na dnu Control Panel stranice.

### Korak 5: Proveri WebDAV Server Status

1. **Package Center → WebDAV Server**
2. Proveri da li je status: **"Running"** (zeleno)
3. Ako nije, klikni **"Open"** ili **"Start"**

### Korak 6: Test Ponovo

Nakon što dodaš firewall pravilo i klikneš Apply, testiraj ponovo:

```
https://mr-engines.chickenkiller.com:5006
```

## Javi Rezultate

**Proveri i javi:**
1. Da li je firewall Enabled ili Disabled?
2. Ako je Enabled, da li postoji pravilo za port 5006?
3. Ako postoji pravilo, da li je Action: Allow?
4. Da li je WebDAV Server status "Running"?

Na osnovu toga ćemo videti tačno gde je problem!
