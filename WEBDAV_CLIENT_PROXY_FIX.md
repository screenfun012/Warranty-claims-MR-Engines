# WebDAV Client Proxy Fix - 405 Method Not Allowed

## Problem

**Greška:** `405 Method Not Allowed` sa Vercel-a, ali lokalno na Droplet-u radi.

**Uzrok:** WebDAV klijent (`webdav` npm paket) možda ne prosleđuje SSL sertifikat pravilno kroz proxy, ili možda treba dodatne opcije.

## Rešenje

### Opcija 1: Dodaj `httpsAgent` opcije za WebDAV klijent

**Problem:** WebDAV klijent možda ne prihvata self-signed sertifikat od proxy-ja.

**Rešenje:** Dodaj `httpsAgent` sa `rejectUnauthorized: false` za WebDAV klijent.

### Korak 1: Ažuriraj `fileStorage.ts`

**Otvori:**
```bash
nano lib/files/fileStorage.ts
```

**Pronađi deo gde se kreira WebDAV klijent (oko linije 38) i dodaj:**

```typescript
import { createClient } from "webdav";
import https from "https";

// Initialize WebDAV client if configured
let webdavClient: WebDAVClient | null = null;
if (USE_WEBDAV) {
  try {
    console.log("[FileStorage] Initializing WebDAV client...");
    
    // Create HTTPS agent that accepts self-signed certificates
    const httpsAgent = new https.Agent({
      rejectUnauthorized: false, // Accept self-signed certificate from proxy
    });
    
    webdavClient = createClient(env.WEBDAV_URL, {
      username: env.WEBDAV_USERNAME,
      password: env.WEBDAV_PASSWORD,
      httpsAgent: httpsAgent, // Use custom HTTPS agent
    });
    console.log("[FileStorage] ✓ WebDAV client initialized successfully:", env.WEBDAV_URL);
    console.log("[FileStorage] WebDAV base path:", env.WEBDAV_BASE_PATH);
  } catch (error) {
    console.error("[FileStorage] ✗ Failed to initialize WebDAV client:", error);
    webdavClient = null;
  }
}
```

### Korak 2: Ažuriraj `webdav-test/route.ts`

**Otvori:**
```bash
nano app/api/debug/webdav-test/route.ts
```

**Pronađi deo gde se kreira WebDAV klijent (oko linije 28) i dodaj:**

```typescript
import { createClient } from "webdav";
import https from "https";

// Create WebDAV client
const httpsAgent = new https.Agent({
  rejectUnauthorized: false, // Accept self-signed certificate from proxy
});

const webdavClient = createClient(env.WEBDAV_URL, {
  username: env.WEBDAV_USERNAME,
  password: env.WEBDAV_PASSWORD,
  httpsAgent: httpsAgent, // Use custom HTTPS agent
});
```

### Korak 3: Proveri da li lokalni test na Droplet-u i dalje radi

**Na Droplet-u, testiraj:**

```bash
curl -k -X PROPFIND https://localhost:5006 \
  -H "Depth: 0" \
  -u "webdav-user:3crpJxrKS60NuE7" \
  2>&1 | head -30
```

**Trebalo bi da vidiš WebDAV XML response.**

### Korak 4: Redeploy na Vercel-u

**Nakon što ažuriraš kod:**

```bash
git add lib/files/fileStorage.ts app/api/debug/webdav-test/route.ts
git commit -m "Add httpsAgent for WebDAV client to accept self-signed proxy certificate"
git push origin main
```

**Vercel će automatski redeploy-ovati aplikaciju.**

### Korak 5: Test sa Vercel-a

**Nakon redeploy-a, testiraj:**

```
https://your-app.vercel.app/api/debug/webdav-test
```

**Trebalo bi da vidiš `"success": true`.**

---

## Alternativno: Proveri Nginx Access Logs

**Ako i dalje ne radi, proveri Nginx access logs:**

```bash
# Na Droplet-u
tail -50 /var/log/nginx/access.log | grep 405
```

**Proveri:**
1. Da li zahtevi dolaze na proxy?
2. Koja metoda se koristi (PROPFIND, GET, itd.)?
3. Šta vraća Synology (405, 200, itd.)?

---

## Alternativno: Test direktno sa Synology-a

**Proveri da li Synology WebDAV direktno radi sa Vercel-a:**

**Trenutno na Vercel-u, probaj direktno ka Synology-u:**

```
WEBDAV_URL=https://100.80.235.71:5006
```

**Ako radi direktno, problem je u Nginx proxy-ju.**

**Ako ne radi direktno, problem je u Tailscale konekciji sa Vercel-a.**

---

**Javi rezultate:**
1. Da li lokalni test na Droplet-u i dalje radi?
2. Šta piše u Nginx access log-u (`tail -50 /var/log/nginx/access.log`)?
3. Da li želiš da ažuriram kod sa `httpsAgent` opcijama?
