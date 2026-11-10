const { test } = require('node:test');
const assert = require('node:assert/strict');
const { generateReply, SYSTEM_INSTRUCTION } = require('./gemini');
const messages = [
  { role: 'user', content: 'What is gravity?' },
  { role: 'assistant', content: 'Gravity is attraction.' },
  { role: 'user', content: 'Explain in Hindi.' },
];
const collect = async stream => {
  let text = '';
  for await (const chunk of stream) {
    text += chunk;
  }
  return text;
};

test('Gemini receives server instructions, conversation context, and streams its response', async () => {
  let request;
  const client = {
    models: {
      generateContentStream: async function* (input) {
        request = input;
        yield { text: 'गुरुत्वाकर्षण ' };
        yield { text: 'एक आकर्षण बल है।' };
      },
    },
  };
  assert.equal(
    await collect(generateReply({ messages, language: 'hi-Deva-IN', client })),
    'गुरुत्वाकर्षण एक आकर्षण बल है।',
  );
  assert.deepEqual(
    request.contents.map(message => message.role),
    ['user', 'model', 'user'],
  );
  assert.match(request.config.systemInstruction, /BharatShikshak AI/);
  assert.match(SYSTEM_INSTRUCTION, /powered by Google Gemini/);
});

test('provider failures are sanitized and rate limits retain their status', async () => {
  const client = {
    models: {
      generateContentStream: async () => {
        throw Object.assign(new Error('secret-provider-detail'), {
          status: 429,
        });
      },
    },
  };
  await assert.rejects(
    collect(generateReply({ messages, language: 'en', client })),
    error =>
      error.code === 'rate_limited' &&
      error.status === 429 &&
      !error.message.includes('secret'),
  );
});

test('blocked or empty responses never become fabricated assistant answers', async () => {
  const client = {
    models: {
      generateContentStream: async function* () {
        yield { promptFeedback: { blockReason: 'SAFETY' } };
      },
    },
  };
  await assert.rejects(
    collect(generateReply({ messages, language: 'en', client })),
    error => error.code === 'response_blocked',
  );
});
