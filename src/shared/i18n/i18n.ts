import { useCallback, useMemo } from 'react';
import { getLocales } from 'expo-localization';
import { useSettingsStore, type LanguagePreference } from '@/shared/preferences/useSettingsStore';
import { translations, type Locale, type TranslationKey } from './translations';

export const resolveLocale = (preference: LanguagePreference): Locale => {
  if (preference === 'es' || preference === 'en') return preference;
  return getLocales()[0]?.languageCode === 'en' ? 'en' : 'es';
};

export const translate = (
  locale: Locale,
  key: TranslationKey,
  values?: Record<string, string | number>,
): string => {
  let value: string = translations[locale][key] ?? translations.es[key];
  for (const [name, replacement] of Object.entries(values ?? {})) {
    value = value.replaceAll(`{${name}}`, String(replacement));
  }
  return value;
};

export const useI18n = () => {
  const preference = useSettingsStore((state) => state.language);
  const locale = resolveLocale(preference);
  const t = useCallback(
    (key: TranslationKey, values?: Record<string, string | number>) =>
      translate(locale, key, values),
    [locale],
  );
  const formatDate = useCallback(
    (date: Date, options: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat(locale === 'es' ? 'es' : 'en', options).format(date),
    [locale],
  );

  return useMemo(() => ({ locale, t, formatDate }), [locale, t, formatDate]);
};
