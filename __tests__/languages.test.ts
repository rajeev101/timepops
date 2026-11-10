import languages from '../shared/languages.json';

test('all 22 Scheduled Languages plus English have distinct script-aware locales', () => {
  expect(languages.filter(language => language.scheduled)).toHaveLength(22);
  expect(languages).toHaveLength(23);
  expect(new Set(languages.map(language => language.code)).size).toBe(23);
  expect(languages.some(language => language.code === 'ne')).toBe(true);
  for (const language of languages) {
    expect(Intl.getCanonicalLocales(language.locale)).toEqual([
      language.locale,
    ]);
    expect(language.nativeName).toBeTruthy();
    expect(language.font).toMatch(/^Noto/);
  }
  expect(
    languages
      .filter(language => language.direction === 'rtl')
      .map(language => language.code),
  ).toEqual(['ur', 'ks', 'sd']);
});
