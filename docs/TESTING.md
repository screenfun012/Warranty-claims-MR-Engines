# Test checklist

## Posle Faze 1 (loading + stilovi)

- [ ] `npm run build` prolazi bez greške
- [ ] Login → redirect na dashboard ili home
- [ ] Logout → redirect na login
- [ ] **Inbox:** ulazak na `/inbox` – vidi se loading (skeleton), zatim lista thread-ova; otvori thread – poruke i prilozi
- [ ] **Claims:** ulazak na `/claims` – loading, zatim lista; otvori claim – tabovi (Metadata, Emails, Documents, Findings, Photos)
- [ ] **Dashboard:** učitavanje, grafici
- [ ] **Claim detail:** ulazak na `/claims/[id]` – loading, zatim sadržaj

## Posle Faze 2 (lazy tabovi, cache)

- [ ] Claim detail: prvi ulazak nije sporiji; svi tabovi rade kad se otvore
- [ ] Inbox / claims lista: drugi put (refresh) bez duge prazne strane
- [ ] Inbox: isto ponašanje kao pre (lista, thread, poruke, boje)

## Posle Faze 3 (export planner, refaktor)

- [ ] Export planner: ulazak, Gantt, drag-and-drop, akcije
- [ ] Claims: filtriranje, sortiranje, kreiranje, edit

## Automatski testovi (kad se uvedu)

- **Unit (Vitest):** `normalizeSerbianLatin`, `cleanSubject` / `extractCleanBody` (emailThreadingUtils)
- **E2E (Playwright):** login → claims → otvori claim; login → inbox → otvori thread
