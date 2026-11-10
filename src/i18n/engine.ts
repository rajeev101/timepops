import { createInstance } from 'i18next';
import languages from '../../shared/languages.json';
import english from '../../locales/en.json';
import { resourceLoaders } from './resources';

export const languageRegistry = languages;
export type AppLanguage = (typeof languages)[number];
export const LANGUAGE_STORAGE_KEY = 'studentai:preferred-language:v1';
export const i18n = createInstance();
export const i18nReady = i18n.init({
  lng: 'en',
  fallbackLng: 'en',
  resources: { en: { translation: english } },
  interpolation: { escapeValue: false },
  initAsync: false,
  returnNull: false,
});

export function resolveLanguage(locale?: string | null): AppLanguage {
  const normalized = locale?.replace(/_/g, '-').toLowerCase();
  return (
    languages.find(
      language =>
        language.locale.toLowerCase() === normalized ||
        language.code === normalized,
    ) ?? languages[0]
  );
}

export async function activateLanguage(code: string) {
  const language = resolveLanguage(code);
  if (!i18n.hasResourceBundle(language.code, 'translation')) {
    i18n.addResourceBundle(
      language.code,
      'translation',
      await resourceLoaders[language.code](),
    );
  }
  await i18n.changeLanguage(language.code);
  return language;
}

const sourceKeys = new Map(
  Object.entries(english.ui).map(([key, source]) => [source, `ui.${key}`]),
);
sourceKeys.set('PREVIEW', 'ui.preview');
sourceKeys.set('Curriculum', 'ui.curriculum');
sourceKeys.set('Smart Review', 'ui.smartReview');
sourceKeys.set('Mock Test', 'ui.mockTest');

export function translateSource(source: string): string {
  const key = sourceKeys.get(source.trim());
  return key ? String(i18n.t(key)) : source;
}

export function translationCoverage(code: string) {
  const local = i18n.getResourceBundle(code, 'translation')?.ui ?? {};
  return {
    translated: Object.keys(local).length,
    total: Object.keys(english.ui).length,
    missing: Object.keys(english.ui).filter(
      key => typeof local[key] !== 'string',
    ),
  };
}
