# Multilingual Architecture

## Release Status

This is an implemented foundation, not a production-ready multilingual release.
It includes 22 Scheduled Languages plus English. Nepali is Scheduled; English
is the additional fallback language. UI translations are drafts, not certified
native-language translations. Many non-Hindi UI bundles have incomplete key
coverage and deliberately fall back to English with a visible notice.

No educational translation is automatically treated as reviewed or published.
Existing educational material is an English preview, not an official syllabus.
Legacy study screens require explicit English consent under another language.

## Client

- `shared/languages.json`: canonical locale, script, direction, and font registry.
- `locales/`: UI messages only; never lesson facts or question-bank records.
- `src/i18n/LanguageProvider.tsx`: first-launch selection, persistent device
  preference, and an optional authenticated profile adapter. Device preference
  is independent of guest/user bookmark storage and survives logout.
- `src/i18n/resources.ts`: loads a language bundle into i18next on selection.
  Metro still packages the JSON files; this is not remote code splitting.
- `src/i18n/components.tsx`: transitional source-string adapter for legacy UI,
  script font selection, and basic direction support. Explicit translation keys
  should replace the remaining legacy English strings before release.
- `src/i18n/ContentLanguageGate.tsx`: per-content, per-locale English consent.
- `src/api.ts`: locale-isolated five-minute catalog cache, authenticated profile
  preference adapter, and lesson content client rejecting unsolicited fallback.
- `shared/search.js`: Unicode normalization and a small alias/transliteration
  lexicon shared by client and server. Extend it with reviewed language-specific
  aliases; it is not comprehensive transliteration for all 22 languages.
- `assets/fonts/`: 12 Noto font families linked into Android and iOS. Individual
  SIL licenses are in `assets/font-licenses/`. Run `npx react-native-asset` after
  changing assets and rebuild the native app.

Alternate-script locales in the registry are metadata only, not selectable
translation variants. Full RTL layout, script shaping, screen-reader phrasing,
font scaling, and phone/tablet/iOS screenshots still require device verification.

## Database And Authentication

Use PostgreSQL with `pg_trgm`; the optional tutor migration also requires
`pgvector`. Populate backend environment variables from `.env.example` using a
secret manager or a local ignored `.env`. Never put provider keys in the app.

From RNApp, with a real database and environment configured:

```sh
node --env-file=backend/.env backend/migrate.js
node --env-file=backend/.env backend/embedding-worker.js --migrate
node --env-file=backend/.env backend/server.js
node --env-file=backend/.env backend/embedding-worker.js
```

The base migration separates language-independent identities from translations
for categories, courses, lessons, and questions. It adds FTS/trigram indexes,
review status, localized video/PDF/subtitle URLs, audit records, and job queues.
Course metadata seeds remain unpublished. These migrations have not been
executed against PostgreSQL in this development environment.

Configure an external identity provider with HTTPS JWKS, issuer, and audience.
Only verified RS256/ES256 bearer tokens are accepted. Editorial endpoints also
require the configured role claim to equal `admin`. No working sign-in flow or
admin UI is supplied yet. Do not equate role-protected APIs with a complete CMS.

## API Contracts

- `GET /api/languages`: 23 primary options and draft UI status.
- `GET /api/catalog?language=hi-Deva-IN`: preview tree; uses published translated
  course metadata when configured. Educational units remain explicitly English.
- `GET /api/search?q=ganit&language=hi`: preview aliases locally; published FTS,
  trigram, and alias search with PostgreSQL. Query language hints affect ranking.
- `GET /api/lessons/:id/content?language=hi-Deva-IN`: only published material in
  active languages and published courses. A missing translation returns 409
  with consent metadata when English exists, otherwise 404. Only `fallback=en`
  authorizes returning English. The app must obtain consent before adding it.
- `PATCH /api/me/language`: authenticated BCP 47 preference persistence.
- `GET /api/admin/translations?entity=lesson&language=hi`: review queue.
- `PUT /api/admin/translations/:entity/:id`: editable fields on an existing
  common identity. Saving invalidates review and restarts `in_progress`.
- `POST /api/admin/translations/:entity/:id/status`: review transitions with
  audit entries. AI drafts must pass human review, approval, then publication.
  Publishing lessons queues embedding work. Common lesson/question creation,
  course publication controls, asset uploads, completion reports, and language
  activation management still need a complete editorial workflow and UI.

## Grounded Tutor

`POST /api/tutor` requires authentication, question, courseId, primary language,
and mode (`teach` or `explain`). `allowEnglishSources` defaults to false and must
follow explicit user consent. This reviewed-material tutor remains separate from
the new Gemini general-conversation chat documented in `CHAT.md`. The latter
does not claim that arbitrary generated answers use approved course material.

Configure `OPENAI_API_KEY`, an explicit structured-output-capable `TUTOR_MODEL`,
and `EMBEDDING_MODEL` (default `text-embedding-3-small`, 1536 dimensions). The
bounded worker processes up to ten jobs per invocation with batched embeddings,
leased job claims, three attempts, Unicode-aware chunking, and source hashes.
Schedule it externally. No automatic AI translation worker is implemented.

Retrieval is restricted to the requested course, published reviewed material,
active languages, matching embedding model, and current content hash. Answers
request the chosen language/script and validated source citations. No context,
insufficient evidence, or invalid citations produces an abstention. Grounding
and citation checks reduce risk; they do not prove every generated statement
correct. Native-language factual and adversarial evaluations remain mandatory.

## Release Gates

Complete native review and all UI keys; replace remaining source-string adapters;
publish vetted lessons/questions and localized assets; integrate sign-in and
profile restore; build the editorial interface; test migrations and real JWTs;
evaluate retrieval, hallucinations, scripts, RTL, PDFs, videos, and subtitles;
add shared-store quotas, provider-cost controls, monitoring, backups, TLS, and
deployment-specific authorization/entitlement rules. Configure a deployed HTTPS
client API URL before release. Local loopback/ADB forwarding is development only.

Automated checks: `npm test -- --runInBand`, `npm --prefix backend test`,
`npx tsc --noEmit`, and `npm run lint`. Provider unit tests use mocks; they are
not evidence of successful live model or PostgreSQL integration.

Current local verification: 45 frontend tests and 26 backend tests pass, as do
TypeScript and lint. The ARM64 Android build installed on the Samsung device.
The phone was locked, so no successful visual verification is claimed. Metro
and the API are running. iOS and PostgreSQL/provider integration remain untested.

The runtime npm audit reports four low-severity advisories in the existing
React Native CLI/deepmerge dependency chain. The full install reports 20
advisories including development tooling. Dependency remediation and a fresh
deployment audit are release gates; no breaking forced upgrades were applied.