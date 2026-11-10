const express = require('express');
const languages = require('../shared/languages.json');
const { normalizeSearch, matchesSearch } = require('../shared/search');
const { database } = require('./database');
const { authenticate, requireAdmin } = require('./auth');
const { canTransition } = require('./translation-workflow');
const catalog = require('./catalog');
const { rateLimit } = require('express-rate-limit');
const { answerQuestion } = require('./tutor');

const router = express.Router();
router.use(express.json({ limit: '64kb' }));
const localeFor = value =>
  languages.find(
    language =>
      language.code === value ||
      language.locale.toLowerCase() === String(value).toLowerCase(),
  );
const tables = {
  course: {
    table: 'course_translations',
    parent: 'course_id',
    fields: ['title', 'description'],
  },
  lesson: {
    table: 'lesson_translations',
    parent: 'lesson_id',
    fields: [
      'title',
      'description',
      'content',
      'video_url',
      'document_url',
      'subtitle_url',
    ],
  },
  question: {
    table: 'question_translations',
    parent: 'question_id',
    fields: ['question_text', 'explanation', 'options'],
  },
  category: {
    table: 'category_translations',
    parent: 'category_id',
    fields: ['title', 'description'],
  },
};

router.get('/languages', (_request, response) => {
  response
    .set('Cache-Control', 'public, max-age=3600')
    .json({
      languages,
      uiTranslationStatus: 'draft',
      scheduledLanguageCount: 22,
    });
});

router.get('/search', async (request, response) => {
  const query = request.query.q;
  if (typeof query !== 'string' || query.length < 1 || query.length > 200) {
    return response
      .status(400)
      .json({ error: 'Search query must contain 1 to 200 characters' });
  }
  const { terms, languages: requestedLanguages } = normalizeSearch(query);
  const preference = localeFor(request.query.language ?? 'en');
  if (!preference) {
    return response.status(400).json({ error: 'Unsupported language' });
  }
  const language = localeFor(requestedLanguages[0]) ?? preference;
  if (!process.env.DATABASE_URL) {
    return response.json({
      source: 'preview',
      requestedLanguage: language.locale,
      languageHints: requestedLanguages,
      results: catalog.courses
        .filter(course =>
          matchesSearch(`${course.title} ${course.summary}`, query),
        )
        .map(course => ({
          ...course,
          contentLanguage: 'en-Latn-IN',
          fallbackRequired: language.code !== 'en',
        })),
    });
  }
  if (!terms.length) {
    return response.json({ source: 'postgresql', results: [] });
  }
  const result = await database().query(
    "SELECT c.id, ct.title, ct.description, ct.language_id AS \"contentLanguage\" FROM courses c JOIN course_translations ct ON ct.course_id=c.id JOIN languages l ON l.locale=ct.language_id WHERE c.status='published' AND ct.content_status='published' AND l.is_active AND (ct.search_document @@ websearch_to_tsquery('simple',$1) OR similarity(ct.title,$1)>0.15 OR EXISTS(SELECT 1 FROM search_aliases a WHERE a.course_id=c.id AND a.alias ILIKE '%' || $1 || '%')) ORDER BY (ct.language_id=$2) DESC, ts_rank(ct.search_document,websearch_to_tsquery('simple',$1)) DESC LIMIT 30",
    [terms.join(' '), language.locale],
  );
  response.json({
    source: 'postgresql',
    requestedLanguage: language.locale,
    results: result.rows.map(row => ({
      ...row,
      fallbackRequired: row.contentLanguage !== language.locale,
    })),
  });
});

router.get('/lessons/:id/content', async (request, response) => {
  const language = localeFor(request.query.language ?? 'en');
  if (!language) {
    return response.status(400).json({ error: 'Unsupported language' });
  }
  const pool = database();
  const result = await pool.query(
    "SELECT lt.title,lt.description,lt.content,lt.video_url,lt.document_url,lt.subtitle_url,lt.language_id FROM lesson_translations lt JOIN lessons l ON l.id=lt.lesson_id JOIN courses c ON c.id=l.course_id JOIN languages lang ON lang.locale=lt.language_id WHERE lt.lesson_id=$1 AND lt.content_status='published' AND c.status='published' AND lang.is_active",
    [request.params.id],
  );
  const preferred = result.rows.find(
    row => row.language_id === language.locale,
  );
  if (preferred) {
    return response.json({
      available: true,
      contentLanguage: language.locale,
      content: preferred,
    });
  }
  const english = result.rows.find(row => row.language_id === 'en-Latn-IN');
  if (request.query.fallback === 'en' && english) {
    return response.json({
      available: true,
      requestedLanguage: language.locale,
      contentLanguage: 'en-Latn-IN',
      fallbackAccepted: true,
      content: english,
    });
  }
  response
    .status(english ? 409 : 404)
    .json({
      available: false,
      code: 'translation_unavailable',
      requestedLanguage: language.locale,
      availableLanguages: result.rows.map(row => row.language_id),
      fallbackRequiresConsent: !!english,
      fallbackLanguage: english ? 'en-Latn-IN' : null,
    });
});

router.patch('/me/language', authenticate, async (request, response) => {
  const language = localeFor(request.body?.language);
  if (!language) {
    return response.status(400).json({ error: 'Unsupported language' });
  }
  await database().query(
    'INSERT INTO users(id,preferred_language) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET preferred_language=$2,updated_at=now()',
    [request.identity.id, language.locale],
  );
  response.json({ preferredLanguage: language.locale });
});

router.get(
  '/admin/translations',
  authenticate,
  requireAdmin,
  async (request, response) => {
    const entity = request.query.entity ?? 'course';
    const config = Object.hasOwn(tables, entity) ? tables[entity] : null;
    const language = localeFor(request.query.language ?? 'en');
    if (!config || !language) {
      return response.status(400).json({ error: 'Invalid entity or language' });
    }
    const result = await database().query(
      `SELECT * FROM ${config.table} WHERE language_id=$1 ORDER BY updated_at DESC LIMIT 100`,
      [language.locale],
    );
    response.json({ translations: result.rows });
  },
);

router.put(
  '/admin/translations/:entity/:id',
  authenticate,
  requireAdmin,
  async (request, response) => {
    const config = Object.hasOwn(tables, request.params.entity)
      ? tables[request.params.entity]
      : null;
    const language = localeFor(request.body?.language);
    if (
      !config ||
      !language ||
      !request.body?.fields ||
      typeof request.body.fields !== 'object'
    ) {
      return response.status(400).json({ error: 'Invalid translation record' });
    }
    const fields = Object.keys(request.body.fields);
    if (
      !fields.length ||
      fields.some(field => !config.fields.includes(field)) ||
      fields.some(field =>
        field === 'options'
          ? !Array.isArray(request.body.fields[field]) ||
            !request.body.fields[field].every(
              option => typeof option === 'string',
            )
          : typeof request.body.fields[field] !== 'string',
      )
    ) {
      return response.status(400).json({ error: 'Invalid translated fields' });
    }
    if (
      fields.some(
        field =>
          field.endsWith('_url') &&
          request.body.fields[field] &&
          !/^https:\/\//.test(request.body.fields[field]),
      )
    ) {
      return response
        .status(400)
        .json({ error: 'Localized assets must use HTTPS' });
    }
    const values = fields.map(field =>
      field === 'options'
        ? JSON.stringify(request.body.fields[field])
        : request.body.fields[field],
    );
    await database().query(
      `INSERT INTO ${config.table}(${config.parent},language_id,${fields.join(
        ',',
      )},content_status) VALUES($1,$2,${fields
        .map((_, index) => `$${index + 3}`)
        .join(',')},'in_progress') ON CONFLICT(${
        config.parent
      },language_id) DO UPDATE SET ${fields
        .map((field, index) => `${field}=$${index + 3}`)
        .join(
          ',',
        )},content_status='in_progress',reviewed_by=NULL,reviewed_at=NULL,updated_at=now()`,
      [request.params.id, language.locale, ...values],
    );
    response.json({ status: 'in_progress' });
  },
);

router.post(
  '/admin/translations/:entity/:id/status',
  authenticate,
  requireAdmin,
  async (request, response) => {
    const config = Object.hasOwn(tables, request.params.entity)
      ? tables[request.params.entity]
      : null;
    const language = localeFor(request.body?.language);
    if (!config || !language || typeof request.body?.status !== 'string') {
      return response.status(400).json({ error: 'Invalid transition' });
    }
    const client = await database().connect();
    try {
      await client.query('BEGIN');
      const record = await client.query(
        `SELECT content_status FROM ${config.table} WHERE ${config.parent}=$1 AND language_id=$2 FOR UPDATE`,
        [request.params.id, language.locale],
      );
      const previous = record.rows[0]?.content_status;
      if (!canTransition(previous, request.body.status)) {
        await client.query('ROLLBACK');
        return response
          .status(409)
          .json({ error: 'Translation must follow the review workflow' });
      }
      await client.query(
        'INSERT INTO users(id) VALUES($1) ON CONFLICT(id) DO NOTHING',
        [request.identity.id],
      );
      await client.query(
        `UPDATE ${config.table} SET content_status=$3,reviewed_by=CASE WHEN $3='approved' THEN $4 ELSE reviewed_by END,reviewed_at=CASE WHEN $3='approved' THEN now() ELSE reviewed_at END,updated_at=now() WHERE ${config.parent}=$1 AND language_id=$2`,
        [
          request.params.id,
          language.locale,
          request.body.status,
          request.identity.id,
        ],
      );
      await client.query(
        'INSERT INTO translation_audit(entity_type,entity_id,language_id,actor_id,previous_status,next_status) VALUES($1,$2,$3,$4,$5,$6)',
        [
          request.params.entity,
          request.params.id,
          language.locale,
          request.identity.id,
          previous,
          request.body.status,
        ],
      );
      if (
        request.body.status === 'published' &&
        request.params.entity === 'lesson'
      ) {
        await client.query(
          "INSERT INTO translation_jobs(entity_type,entity_id,language_id,job_type) VALUES('lesson',$1,$2,'embedding')",
          [request.params.id, language.locale],
        );
      }
      await client.query('COMMIT');
      response.json({ status: request.body.status });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },
);

router.post(
  '/tutor',
  rateLimit({
    windowMs: 60000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  }),
  authenticate,
  async (request, response) => {
    const {
      question,
      courseId,
      mode,
      allowEnglishSources = false,
    } = request.body ?? {};
    const language = localeFor(request.body?.language);
    if (
      !language ||
      typeof question !== 'string' ||
      !question.trim() ||
      question.length > 2000 ||
      typeof courseId !== 'string' ||
      !courseId ||
      courseId.length > 200 ||
      !['teach', 'explain'].includes(mode) ||
      typeof allowEnglishSources !== 'boolean'
    ) {
      return response
        .status(400)
        .json({ error: 'Invalid tutor question, course, mode, or language' });
    }
    if (
      !process.env.DATABASE_URL ||
      !process.env.OPENAI_API_KEY ||
      !process.env.TUTOR_MODEL
    ) {
      return response
        .status(503)
        .json({
          code: 'grounded_tutor_unavailable',
          error:
            'Configure approved material, database, embeddings, and AI provider first.',
        });
    }
    response
      .set('Cache-Control', 'no-store')
      .json(
        await answerQuestion({
          question: question.trim(),
          courseId,
          mode,
          language,
          allowEnglishSources,
        }),
      );
  },
);

module.exports = router;
