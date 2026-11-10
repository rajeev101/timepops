const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const app = require('./app');
const { canTransition } = require('./translation-workflow');
const { normalizeSearch, matchesSearch } = require('../shared/search');
let server;
let base;
before(async () => {
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => {
  await new Promise(resolve => server.close(resolve));
});
test('registry exposes 22 Scheduled Languages plus English', async () => {
  const result = await (await fetch(`${base}/languages`)).json();
  assert.equal(result.languages.length, 23);
  assert.equal(result.scheduledLanguageCount, 22);
});
test('mixed-script and transliterated searches match across titles', async () => {
  for (const query of ['Mathematics', 'गणित', 'Maths in Hindi']) {
    assert.ok(matchesSearch('Mathematics', query));
  }
  assert.ok(matchesSearch('Python for Beginners', 'Python सीखें'));
  assert.deepEqual(normalizeSearch('தமிழ் Physics'), {
    terms: ['physics'],
    languages: ['ta'],
  });
  assert.deepEqual(normalizeSearch('ganit'), {
    terms: ['math'],
    languages: [],
  });
  const result = await (
    await fetch(
      `${base}/search?q=${encodeURIComponent('Python सीखें')}&language=hi`,
    )
  ).json();
  assert.equal(result.results[0].id, 'python');
  assert.equal(result.results[0].fallbackRequired, true);
});
test('AI-generated translations cannot publish without human review', () => {
  assert.equal(canTransition('ai_translated', 'published'), false);
  assert.equal(canTransition('in_progress', 'approved'), false);
  assert.equal(canTransition('ai_translated', 'under_review'), true);
  assert.equal(canTransition('under_review', 'approved'), true);
  assert.equal(canTransition('approved', 'published'), true);
});

test('search language hints override the interface locale without hiding fallback status',async()=>{
  if (process.env.DATABASE_URL) {return;}
  const result=await (await fetch(`${base}/search?q=${encodeURIComponent('Maths in Hindi')}&language=en`)).json();
  assert.equal(result.requestedLanguage,'hi-Deva-IN');assert.ok(result.results.length);assert.equal(result.results[0].fallbackRequired,true);
});
test('unconfigured educational content and tutor fail closed', async () => {
  if (!process.env.DATABASE_URL) {
    const response = await fetch(`${base}/lessons/example/content?language=hi`);
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, 'database_unavailable');
  }
  assert.equal((await fetch(`${base}/tutor`, { method: 'POST' })).status, 503);
});
test('profile and administrator endpoints never accept anonymous writes', async () => {
  const response = await fetch(`${base}/me/language`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ language: 'hi' }),
  });
  assert.ok([401, 503].includes(response.status));
  assert.ok(
    [401, 503].includes((await fetch(`${base}/admin/translations`)).status),
  );
});
