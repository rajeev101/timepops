import {
  activateLanguage,
  i18n,
  languageRegistry,
  resolveLanguage,
  translateSource,
  translationCoverage,
} from '../src/i18n/engine';

afterEach(async () => {
  await activateLanguage('en');
});

test('all language resources contain native UI messages rather than English copies', async () => {
  for (const language of languageRegistry) {
    await activateLanguage(language.code);
    expect(i18n.t('ui.chooseLanguage')).not.toBe('ui.chooseLanguage');
    if (language.code !== 'en') {
      expect(i18n.t('ui.chooseLanguage')).not.toBe(
        'Choose Your Preferred Language',
      );
      expect(i18n.t('ui.english')).not.toBe('English Learning');
    }
    expect(
      translationCoverage(language.code).translated,
    ).toBeGreaterThanOrEqual(30);
  }
});

test('global language switching updates shared labels and missing keys fall back to English', async () => {
  await activateLanguage('hi');
  expect(translateSource('Study')).toBe('पढ़ाई');
  await activateLanguage('ta');
  expect(translateSource('Study')).toBe('படிப்பு');
  expect(i18n.t('ui.preferenceError')).toBe(
    'Your language could not be saved. Please try again.',
  );
  expect(translationCoverage('ta').missing).toContain('preferenceError');
});

test('unsupported locales use English and Urdu has RTL metadata', () => {
  expect(resolveLanguage('unknown').code).toBe('en');
  expect(resolveLanguage('ur-Arab-IN').direction).toBe('rtl');
  expect(resolveLanguage('mni-Beng-IN').script).toBe('Beng');
});
