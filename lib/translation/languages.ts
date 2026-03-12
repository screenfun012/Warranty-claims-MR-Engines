/**
 * Supported translation languages for the app.
 * Used by translator (DeepL/OpenAI) and UI dropdowns.
 */

export const TRANSLATION_LANGUAGES = [
  { code: "SR", nameSr: "Srpski", nameEn: "Serbian" },
  { code: "EN", nameSr: "Engleski", nameEn: "English" },
  { code: "DE", nameSr: "Nemački", nameEn: "German" },
  { code: "NL", nameSr: "Holandski", nameEn: "Dutch" },
  { code: "FR", nameSr: "Francuski", nameEn: "French" },
  { code: "IT", nameSr: "Italijanski", nameEn: "Italian" },
  { code: "PL", nameSr: "Poljski", nameEn: "Polish" },
  { code: "DA", nameSr: "Danski", nameEn: "Danish" },
  { code: "ES", nameSr: "Španski", nameEn: "Spanish" },
  { code: "SV", nameSr: "Švedski", nameEn: "Swedish" },
] as const;

export type TranslationLangCode = (typeof TRANSLATION_LANGUAGES)[number]["code"];

/** Language codes that are stored in dedicated DB columns (textSr, textEn) */
export const PERSISTED_LANG_COLUMNS = ["SR", "EN"] as const;

export function getTranslationLangName(code: string, locale: "sr" | "en" = "sr"): string {
  const lang = TRANSLATION_LANGUAGES.find((l) => l.code === code);
  return lang ? (locale === "en" ? lang.nameEn : lang.nameSr) : code;
}
