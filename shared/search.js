const aliases = require('./search-aliases.json');
const mapping = new Map(
  Object.entries(aliases).flatMap(([canonical, terms]) =>
    [canonical, ...terms].map(term => [
      term.normalize('NFKC').toLowerCase(),
      canonical,
    ]),
  ),
);
const ignored = new Set([
  'in',
  'on',
  'the',
  'learn',
  'learning',
  'सीखें',
  'सीखना',
  'में',
  'का',
  'की',
  'के',
  'கற்க',
]);
const languageTerms = {
  hindi: 'hi',
  tamil: 'ta',
  marathi: 'mr',
  bengali: 'bn',
  telugu: 'te',
  gujarati: 'gu',
};
function normalizeSearch(query) {
  const tokens = (
    query
      .normalize('NFKC')
      .toLowerCase()
      .match(/[\p{L}\p{M}\p{N}+#.]+/gu) ?? []
  ).map(token => mapping.get(token) ?? token);
  return {
    terms: tokens.filter(token => !ignored.has(token) && !languageTerms[token]),
    languages: [
      ...new Set(
        tokens
          .filter(token => languageTerms[token])
          .map(token => languageTerms[token]),
      ),
    ],
  };
}
function matchesSearch(text, query) {
  const haystack = normalizeSearch(text).terms.join(' ');
  const { terms } = normalizeSearch(query);
  return terms.length > 0 && terms.every(term => haystack.includes(term));
}
module.exports = { normalizeSearch, matchesSearch };
