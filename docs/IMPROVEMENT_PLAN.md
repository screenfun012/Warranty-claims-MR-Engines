# Plan poboljšanja aplikacije

## Faza 1 – Brzi dobitak ✅ (urađeno)

- [x] **Loading UI** – Dodati `loading.tsx` za `/inbox`, `/claims`, `/dashboard`, `/claims/[id]`
- [ ] **Proxy migracija** – Preimenovati `middleware.ts` → `proxy.ts` kada Next.js verzija podrži (trenutno ostaje middleware)
- [x] **Zamena inline stilova** – Tailwind umesto `style={{}}` na inbox, ClaimEmails, claims page

---

## Faza 2 – Performanse (3–5 dana)

- [ ] **Lazy tabovi na `/claims/[id]`** – ClaimEmails, ClaimClientDocuments, ClaimFindings, ClaimPhotos učitati sa `next/dynamic` + Skeleton
- [ ] **API cache** – Kratak Cache-Control ili revalidate na teške GET rute (claims lista, inbox)
- [ ] **Rastavljanje inbox stranice** – ThreadList, ThreadView, MessageCard u zasebne komponente

---

## Faza 3 – Veći refaktor (1–2 nedelje)

- [ ] **Export planner** – Izdvojiti Gantt u komponentu, učitati sa `dynamic(..., { ssr: false })`
- [ ] **Claims lista** – Filteri, tabela i kartice u komponente/hook-ove
- [ ] **Server Components** – Prebaciti delove koji ne trebaju "use client"

---

## Faza 4 – Opciono / kasnije

- [ ] Prisma major upgrade (5 → 7) – poseban branch, vodič
- [ ] Uklanjanje nekorišćenog koda (npr. `mailSyncService-improved.ts` ako nije u upotrebi)
- [ ] E2E testovi za login, claim create/edit, inbox
