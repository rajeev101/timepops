# BharatShikshak AI Chat

## Architecture

React Native Chat -> authenticated/guest-scoped BharatShikshak API -> Google
Gemini -> incremental backend NDJSON -> native chat. The Gemini key and all
system instructions stay in the backend. The user-facing assistant is
**BharatShikshak AI** with the existing emblem, colors, and script-aware fonts.
Its introduction and secondary attribution disclose Google Gemini.

## Configuration

The ignored `backend/.env` is prepared with an empty `GEMINI_API_KEY`. Enter the
key directly in that file, not in chat or frontend code. Select `GEMINI_MODEL`
for a model enabled in your Google project. The example uses `gemini-3.8-flash`
from Google's current text-generation examples; availability and quota still
need verification in your project. Never commit the environment file.

```dotenv
GEMINI_API_KEY=<set directly in your local environment>
GEMINI_MODEL=gemini-3.8-flash
CHAT_ALLOW_GUEST=false
```

`npm --prefix backend run dev` automatically loads the backend-local file.
Restart the backend after editing environment values. Deployed environment
variables take precedence. No real API key was available during implementation,
so a live Gemini answer has not been verified. Missing configuration returns a
friendly unavailable state, never a placeholder answer presented as AI output.

For deployment, set `NODE_ENV=production`, use HTTPS, configure the mobile HTTPS
API URL, and configure verified bearer authentication. Guests are permitted for
local development, but disabled in production unless `CHAT_ALLOW_GUEST=true` is
explicitly set. Do not expose the development loopback server publicly.

## Conversations And History

- Account conversations use PostgreSQL tables in
  `backend/migrations/003_chat.sql`, included in the existing migration command.
  Configure `DATABASE_URL` and run `npm --prefix backend run db:migrate` with the
  environment loaded (for example `node --env-file=backend/.env backend/migrate.js`).
- The app accepts an optional `session={{userId, accessToken}}` from the real
  identity provider. Existing JWT verification checks issuer, audience, JWKS,
  expiry, and algorithm. The backend derives ownership from the verified subject,
  never a client-supplied user ID. No new fake login flow is introduced.
- The current application still launches as a guest until a real authentication
  provider supplies that session. Auth configuration and a live PostgreSQL
  integration test are prerequisites for claiming working cross-device account
  history, even though its client/API/storage contracts are implemented.
- Guests have isolated, expiring in-memory sessions guarded by random 256-bit
  capability tokens. Guest history survives tab changes and new conversations
  in the mounted app, not an app process restart, and expires after an hour of
  inactivity or API restart. Tokens are held in memory, not persisted in device
  storage or logs. Guest sessions require sticky routing if enabled on multiple
  backend instances; use a shared expiring store before scaling guest access.
- History supports list, reopen, and permanent delete. Switching authenticated
  identities remounts and clears client chat state. Requests are aborted on
  unmount. PostgreSQL conversation locks require session-compatible pooling.
- Context includes up to twenty previous successful turns within a 30,000-character
  budget. Failed/interrupted answers are excluded. Conversations allow 100 turns;
  account history lists up to 100 conversations. Older context is not summarized.

## Experience And Reliability

The screen supports natural follow-ups, typing feedback, incremental text,
new conversations, stop, retry, and Markdown headings/lists/code after completion.
Streaming uses XMLHttpRequest progress events and also processes a completed
response if a platform buffers progress. English/Hindi UI messages are supplied;
Gemini is instructed to follow the user's latest language, with the selected
interface locale as the default. Generated answers are not vetted translations
or reviewed syllabus content.

Markdown uses patched parser dependencies. HTML, remote images, and automatic
link detection are disabled. HTTPS links require explicit confirmation. Code
blocks scroll horizontally. No model output is executed.

Both UI and server prevent concurrent duplicate sends. A completed request ID
replays the stored answer without another Gemini call. Failed requests can be
retried with the same ID. Canceling or losing a connection may still incur
provider charges; no system can promise exactly-once billing if the process
crashes after generation but before saving. There are no automatic SDK retries
or continuation requests.

There are request/body/context/output limits, a 60-second backend generation
deadline, a 70-second mobile timeout, per-IP rate limits, sanitized provider
errors, and explicit handling for missing configuration, blocked/truncated
answers, timeouts, expired conversations, and quota failures. Partial failed
output is discarded, not saved as a completed answer.

Before public production deployment, add shared-store rate limiting, per-account
usage/billing budgets, abuse monitoring, data retention/export policies,
backups, and provider privacy review. Local in-process rate limits are not a
distributed quota system. Google receives the selected message context; check
your project/provider terms for data processing and retention. Turning off
request storage is not a promise of zero provider-side retention.

## API

- `POST /api/chat/conversations`: new thread; returns a guest capability only
  for guest threads.
- `GET /api/chat/conversations`: verified account history only.
- `GET /api/chat/conversations/:id`: owned conversation and turns.
- `DELETE /api/chat/conversations/:id`: permanent deletion.
- `POST /api/chat/conversations/:id/messages`: `{message, requestId, language}`,
  where requestId is UUID v4 and language is a primary registry locale.

Account requests use `Authorization: Bearer ...`; guest requests use
`X-Chat-Guest`. Messages stream `start`, `delta`, then `done` or `error` frames.
The backend owns prior messages and instructions; clients cannot submit arbitrary
assistant history, roles, or system prompts.

The earlier `/api/tutor` remains a separate reviewed-material RAG endpoint. Chat
now uses Gemini general conversation and does not require that endpoint's
embeddings/OpenAI configuration or claim that arbitrary Gemini answers are
grounded in published course material.

## Verification

Run `npm test -- --runInBand`, `npm --prefix backend test`, `npx tsc --noEmit`,
and `npm run lint`. Gemini transport tests use a fake SDK and UI tests use mocked
backend responses; these do not prove live credentials, model availability,
provider quality, signed-token integration, or a real PostgreSQL deployment.
