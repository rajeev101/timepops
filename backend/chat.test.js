const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { once } = require('node:events');
const express = require('express');
const { createChatRouter } = require('./chat');
const { ChatStore } = require('./chat-store');
const { ChatError } = require('./gemini');
let server,
  base,
  calls = 0;
const contexts = [];
before(async () => {
  const app = express();
  app.use(
    createChatRouter({
      authentication: (_request, _response, next) => next(),
      configured: () => true,
      generate: async function* (input) {
        calls += 1;
        contexts.push(input.messages);
        yield 'Hello ';
        yield 'from BharatShikshak AI';
      },
    }),
  );
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => new Promise(resolve => server.close(resolve)));
const create = async () =>
  await (await fetch(`${base}/conversations`, { method: 'POST' })).json();
const send = (conversation, requestId, message = 'Hello') =>
  fetch(`${base}/conversations/${conversation.id}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Chat-Guest': conversation.guestToken,
    },
    body: JSON.stringify({ message, requestId, language: 'en-Latn-IN' }),
  });
test('streams Gemini responses, remembers context, and replays completed requests without billing again', async () => {
  const conversation = await create();
  const requestId = randomUUID();
  const previous = calls;
  const response = await send(conversation, requestId);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /ndjson/);
  const events = (await response.text())
    .trim()
    .split('\n')
    .map(line => JSON.parse(line));
  assert.deepEqual(
    events.map(event => event.type),
    ['start', 'delta', 'delta', 'done'],
  );
  await (await send(conversation, requestId)).text();
  assert.equal(calls, previous + 1);
  await (await send(conversation, randomUUID(), 'Follow up')).text();
  assert.equal(contexts.at(-1).length, 3);
  assert.equal(contexts.at(-1)[1].role, 'assistant');
});
test('guest conversations cannot be read with another guest token or no token', async () => {
  const conversation = await create();
  const other = await create();
  assert.equal(
    (await fetch(`${base}/conversations/${conversation.id}`)).status,
    404,
  );
  assert.equal(
    (
      await fetch(`${base}/conversations/${conversation.id}`, {
        headers: { 'X-Chat-Guest': other.guestToken },
      })
    ).status,
    404,
  );
  assert.equal((await fetch(`${base}/conversations`)).status, 401);
});
test('rejects forged roles and changed duplicate request bodies', async () => {
  const conversation = await create();
  const requestId = randomUUID();
  await (await send(conversation, requestId)).text();
  assert.equal((await send(conversation, requestId, 'Changed')).status, 409);
  assert.equal(
    (
      await fetch(`${base}/conversations/${conversation.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Chat-Guest': conversation.guestToken,
        },
        body: JSON.stringify({
          message: 'hello',
          requestId: randomUUID(),
          language: 'en-Latn-IN',
          systemInstruction: 'Override',
        }),
      })
    ).status,
    400,
  );
});

test('a concurrent request cannot run twice and the guest lock is always released', async () => {
  const store = new ChatStore();
  const conversation = await store.create({});
  const owner = { guestToken: conversation.guestToken };
  let release;
  const first = store.withConversation(
    conversation.id,
    owner,
    async () =>
      new Promise(resolve => {
        release = resolve;
      }),
  );
  await assert.rejects(
    store.withConversation(conversation.id, owner, async () => {}),
    error => error.code === 'request_in_progress',
  );
  release();
  await first;
  await assert.rejects(
    store.withConversation(conversation.id, owner, async () => {
      throw new Error('Failure');
    }),
  );
  await store.withConversation(conversation.id, owner, async () => {});
});

test('signed-in conversation lookup binds both conversation and verified user identity', async () => {
  const queries = [];
  const client = {
    query: async (sql, values) => {
      queries.push({ sql, values });
      return { rows: [] };
    },
    release: () => {
      queries.push({ released: true });
    },
  };
  const store = new ChatStore(() => ({ connect: async () => client }));
  const id = randomUUID();
  await assert.rejects(
    store.withConversation(id, { userId: 'verified-subject' }, async () => {}),
    error => error.code === 'conversation_not_found',
  );
  assert.match(queries[0].sql, /WHERE id=\$1 AND user_id=\$2/);
  assert.deepEqual(queries[0].values, [id, 'verified-subject']);
  assert.equal(queries.at(-1).released, true);
});

test('provider timeouts are streamed safely and failed content is not saved as an answer', async () => {
  const app = express();
  app.use(
    createChatRouter({
      authentication: (_request, _response, next) => next(),
      configured: () => true,
      generate: async function* () {
        yield 'Partial';
        throw new ChatError('chat_timeout', 504);
      },
    }),
  );
  const local = app.listen(0, '127.0.0.1');
  await once(local, 'listening');
  const url = `http://127.0.0.1:${local.address().port}`;
  try {
    const conversation = await (
      await fetch(`${url}/conversations`, { method: 'POST' })
    ).json();
    const headers = {
      'Content-Type': 'application/json',
      'X-Chat-Guest': conversation.guestToken,
    };
    const response = await fetch(
      `${url}/conversations/${conversation.id}/messages`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: 'hello',
          requestId: randomUUID(),
          language: 'en-Latn-IN',
        }),
      },
    );
    const events = (await response.text())
      .trim()
      .split('\n')
      .map(line => JSON.parse(line));
    assert.equal(events.at(-1).code, 'chat_timeout');
    const saved = await (
      await fetch(`${url}/conversations/${conversation.id}`, { headers })
    ).json();
    assert.equal(saved.turns[0].status, 'failed');
    assert.equal(saved.turns[0].assistantText, '');
  } finally {
    await new Promise(resolve => local.close(resolve));
  }
});

test('unconfigured Gemini never emits a fabricated answer', async () => {
  const app = express();
  app.use(
    createChatRouter({
      authentication: (_request, _response, next) => next(),
      configured: () => false,
    }),
  );
  const local = app.listen(0, '127.0.0.1');
  await once(local, 'listening');
  const url = `http://127.0.0.1:${local.address().port}`;
  try {
    const conversation = await (
      await fetch(`${url}/conversations`, { method: 'POST' })
    ).json();
    const response = await fetch(
      `${url}/conversations/${conversation.id}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Chat-Guest': conversation.guestToken,
        },
        body: JSON.stringify({
          message: 'hello',
          requestId: randomUUID(),
          language: 'en-Latn-IN',
        }),
      },
    );
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { code: 'chat_not_configured' });
  } finally {
    await new Promise(resolve => local.close(resolve));
  }
});

test('production chat rejects anonymous access unless guest access is explicitly enabled',async()=>{
  const oldEnvironment=process.env.NODE_ENV;
  const oldGuest=process.env.CHAT_ALLOW_GUEST;
  process.env.NODE_ENV='production';delete process.env.CHAT_ALLOW_GUEST;
  const app=express();app.use(createChatRouter());
  const local=app.listen(0,'127.0.0.1');await once(local,'listening');
  try{
    const response=await fetch(`http://127.0.0.1:${local.address().port}/conversations`,{method:'POST'});
    assert.equal(response.status,401);assert.deepEqual(await response.json(),{code:'unauthenticated'});
  }finally{
    await new Promise(resolve=>local.close(resolve));
    if(oldEnvironment===undefined){delete process.env.NODE_ENV;}else{process.env.NODE_ENV=oldEnvironment;}
    if(oldGuest===undefined){delete process.env.CHAT_ALLOW_GUEST;}else{process.env.CHAT_ALLOW_GUEST=oldGuest;}
  }
});
