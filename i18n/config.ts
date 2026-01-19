export const locales = ['sr', 'en'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'sr';

export const localeNames: Record<Locale, string> = {
  sr: 'Srpski',
  en: 'English',
};

export const localeFlags: Record<Locale, string> = {
  sr: '🇷🇸',
  en: '🇬🇧',
};
