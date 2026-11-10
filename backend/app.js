const express = require('express');
const catalog = require('./catalog');
const multilingual = require('./multilingual');
const {createChatRouter} = require('./chat');

const subjects = [
  {
    id: 'math',
    title: 'Mathematics',
    subject: 'Math',
    detail: 'Algebra, functions & equations',
  },
  {
    id: 'physics',
    title: 'Physics',
    subject: 'Physics',
    detail: 'Motion, forces & energy',
  },
  {
    id: 'english',
    title: 'English',
    subject: 'English',
    detail: 'Reading, writing & analysis',
  },
];

const app = express();
app.disable('x-powered-by');

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok' });
});

app.get('/api/subjects', (_request, response) => {
  response.json({ subjects });
});

app.get('/api/catalog', async (request, response) => {
  const languages = require('../shared/languages.json');
  const language =
    languages.find(
      entry =>
        entry.code === request.query.language ||
        entry.locale === request.query.language,
    ) ?? languages[0];
  if (
    request.query.language &&
    !languages.some(
      entry =>
        entry.code === request.query.language ||
        entry.locale === request.query.language,
    )
  ) {
    return response.status(400).json({ error: 'Unsupported language' });
  }
  const { database } = require('./database');
  const localized = process.env.DATABASE_URL
    ? await database().query(
        "SELECT course_id,title,description,language_id FROM course_translations WHERE language_id=$1 AND content_status='published'",
        [language.locale],
      )
    : { rows: [] };
  response.set('Content-Language', language.locale).json({
    ...catalog,
    requestedLanguage: language.locale,
    contentLanguage: 'en-Latn-IN',
    courses: catalog.courses.map(course => {
      const translation = localized.rows.find(
        entry => entry.course_id === course.id,
      );
      return {
        ...course,
        title: translation?.title ?? course.title,
        summary: translation?.description ?? course.summary,
        contentLanguage: 'en-Latn-IN',
        metadataLanguage: translation?.language_id ?? 'en-Latn-IN',
      };
    }),
  });
});

app.use('/api/chat',createChatRouter());
app.use('/api', multilingual);

app.use((_request, response) => {
  response.status(404).json({ error: 'Endpoint not found' });
});

app.use((error, _request, response, _next) => {
  response
    .status(error.status === 503 ? 503 : error.status === 400 ? 400 : 500)
    .json({
      error:
        error.status === 503 ? error.message : 'Request could not be completed',
      code:
        error.code === 'database_unavailable' ? error.code : 'request_failed',
    });
});

module.exports = app;
