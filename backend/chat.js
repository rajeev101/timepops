const express = require('express');
const { rateLimit } = require('express-rate-limit');
const { authenticate } = require('./auth');
const { generateReply, ChatError, safeError } = require('./gemini');
const { ChatStore } = require('./chat-store');
const languages = require('../shared/languages.json');
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function authorize(request, response, next) {
  if (request.headers.authorization !== undefined) {
    return authenticate(request, response, next);
  }
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.CHAT_ALLOW_GUEST !== 'true'
  ) {
    return response.status(401).json({ code: 'unauthenticated' });
  }
  next();
}

function createChatRouter({
  store = new ChatStore(),
  generate = generateReply,
  authentication = authorize,
  configured = () => !!(process.env.GEMINI_API_KEY && process.env.GEMINI_MODEL),
} = {}) {
  const router = express.Router();
  router.use(express.json({ limit: '32kb' }));
  router.use(
    rateLimit({
      windowMs: 60000,
      limit: 40,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      handler: (_request, response) =>
        response.status(429).json({ code: 'rate_limited' }),
    }),
  );
  router.use(authentication);
  router.use((request, _response, next) => {
    request.chatOwner = {
      userId: request.identity?.id,
      guestToken: request.get('X-Chat-Guest'),
    };
    next();
  });
  router.get('/conversations', async (request, response) => {
    response
      .set('Cache-Control', 'no-store')
      .json({ conversations: await store.list(request.chatOwner) });
  });
  router.post('/conversations', async (request, response) => {
    response
      .status(201)
      .set('Cache-Control', 'no-store')
      .json(await store.create(request.chatOwner));
  });
  router.param('id', (request, response, next, id) => {
    if (!uuid.test(id)) {
      return response.status(400).json({ code: 'invalid_request' });
    }
    next();
  });
  router.get('/conversations/:id', async (request, response) => {
    await store.withConversation(
      request.params.id,
      request.chatOwner,
      async conversation =>
        response
          .set('Cache-Control', 'no-store')
          .json({
            id: conversation.id,
            title: conversation.title,
            turns: conversation.turns,
          }),
    );
  });
  router.delete('/conversations/:id', async (request, response) => {
    await store.withConversation(
      request.params.id,
      request.chatOwner,
      async conversation => {
        await conversation.remove();
        response.status(204).end();
      },
    );
  });
  router.post(
    '/conversations/:id/messages',
    rateLimit({
      windowMs: 60000,
      limit: 10,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      handler: (_request, response) =>
        response.status(429).json({ code: 'rate_limited' }),
    }),
    async (request, response) => {
      const { message, requestId, language } = request.body ?? {};
      if (
        typeof message !== 'string' ||
        !message.trim() ||
        message.length > 6000 ||
        typeof requestId !== 'string' ||
        !uuid.test(requestId) ||
        !languages.some(entry => entry.locale === language) ||
        Object.keys(request.body).some(
          key => !['message', 'requestId', 'language'].includes(key),
        )
      ) {
        throw new ChatError('invalid_request', 400);
      }
      await store.withConversation(
        request.params.id,
        request.chatOwner,
        async conversation => {
          const existing = conversation.turns.find(
            turn => turn.requestId === requestId,
          );
          if (existing && existing.userText !== message.trim()) {
            throw new ChatError('invalid_request', 409);
          }
          const emit = event => {
            if (!response.destroyed) {
              response.write(`${JSON.stringify(event)}\n`);
            }
          };
          const start = () => {
            response
              .status(200)
              .set({
                'Content-Type': 'application/x-ndjson; charset=utf-8',
                'Cache-Control': 'no-store, no-transform',
                'X-Accel-Buffering': 'no',
                'X-Content-Type-Options': 'nosniff',
              });
            response.flushHeaders();
          };
          if (existing?.status === 'completed') {
            start();
            emit({ type: 'done', text: existing.assistantText, requestId });
            response.end();
            return;
          }
          if (existing && conversation.turns.at(-1)?.requestId !== requestId) {
            throw new ChatError('invalid_request', 409);
          }
          if (!configured()) {
            throw new ChatError('chat_not_configured');
          }
          if (!existing && conversation.turns.length >= 100) {
            throw new ChatError('conversation_limit', 409);
          }
          const turn = {
            requestId,
            userText: message.trim(),
            assistantText: '',
            status: 'pending',
          };
          await conversation.save(turn);
          const context = conversation.turns
            .filter(item => item.status === 'completed')
            .slice(-20);
          while (
            context.reduce(
              (size, item) =>
                size + item.userText.length + item.assistantText.length,
              0,
            ) > 30000
          ) {
            context.shift();
          }
          const messages = context.flatMap(item => [
            { role: 'user', content: item.userText },
            { role: 'assistant', content: item.assistantText },
          ]);
          messages.push({ role: 'user', content: turn.userText });
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 60000);
          const disconnect = () => controller.abort();
          response.on('close', disconnect);
          try {
            start();
            emit({ type: 'start', requestId });
            for await (const text of generate({
              messages,
              language,
              signal: controller.signal,
            })) {
              if (controller.signal.aborted) {
                throw new ChatError('chat_timeout', 504);
              }
              turn.assistantText += text;
              if (turn.assistantText.length > 32000) {
                throw new ChatError('response_too_long', 422);
              }
              emit({ type: 'delta', text });
            }
            if (!turn.assistantText.trim()) {
              throw new ChatError('response_blocked', 422);
            }
            if (controller.signal.aborted) {
              throw new ChatError('chat_timeout', 504);
            }
            turn.status = 'completed';
            await conversation.save(turn);
            emit({ type: 'done', text: turn.assistantText, requestId });
          } catch (error) {
            turn.status = 'failed';
            turn.assistantText = '';
            await conversation.save(turn);
            emit({
              type: 'error',
              code: controller.signal.aborted
                ? 'chat_timeout'
                : safeError(error).code,
            });
          } finally {
            clearTimeout(timeout);
            response.off('close', disconnect);
            response.end();
          }
        },
      );
    },
  );
  router.use((error, _request, response, _next) => {
    if (response.headersSent) {
      response.end();
      return;
    }
    const invalid = [400, 413].includes(error.status);
    const sanitized =
      error instanceof ChatError
        ? error
        : new ChatError(
            invalid ? 'invalid_request' : 'chat_unavailable',
            invalid ? error.status : 503,
          );
    if (sanitized.status === 429) {
      response.set('Retry-After', '60');
    }
    response
      .status(sanitized.status)
      .set('Cache-Control', 'no-store')
      .json({ code: sanitized.code });
  });
  return router;
}
module.exports = { createChatRouter };
