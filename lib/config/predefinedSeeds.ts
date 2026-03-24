/**
 * Isti seed kao u prisma/migrations/20260121140000_add_predefined_workers_companies
 * Koristi se kada su tabele prazne (npr. posle migracije) — API može ponovo da ih napuni.
 */
export const SEED_PREDEFINED_WORKER_NAMES: string[] = [
  "IVICA STANISAVLJEVIĆ",
  "IVAN STANISAVLJEVIĆ",
  "EMRUŠ DULJAJ",
  "ELMEDIN DULJAJ",
  "PETAR PETROVIĆ",
  "DRAGAN MILOSAVLJEVIĆ",
  "MARKO ŽIVANOVIĆ",
  "DEJAN MILOVANOVIĆ",
  "MILOŠ ĆEBIĆ",
  "BOJAN TANASKOVIĆ",
  "DEJAN SIMIĆ",
  "NIKOLA MIRKOVIĆ",
  "STEFAN NOVAKOVIĆ",
  "NEBOJŠA NIKOLIĆ",
];

export const SEED_PREDEFINED_COMPANY_NAMES: string[] = [
  "APPROVED GREEN",
  "VITOBELLO",
  "AUTO STANIĆ",
  "SELMAN",
  "TVH",
  "CRD",
  "RETTIFICHE 3G",
  "BOLS MOTOREN",
];
