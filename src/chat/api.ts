import { API_BASE_URL } from '../api';

export interface ChatSession {
  userId: string;
  accessToken: string;
}
export interface Conversation {
  id: string;
  title: string;
  guestToken?: string;
  updatedAt?: string;
}
export interface ChatTurn {
  requestId: string;
  userText: string;
  assistantText: string;
  status: 'pending' | 'completed' | 'failed';
}
export class ChatRequestError extends Error {
  constructor(public code: string) {
    super(code);
  }
}
const headers = (
  session?: ChatSession,
  conversation?: Conversation,
): Record<string, string> => ({
  'Content-Type': 'application/json',
  ...(session ? { Authorization: `Bearer ${session.accessToken}` } : {}),
  ...(!session && conversation?.guestToken
    ? { 'X-Chat-Guest': conversation.guestToken }
    : {}),
});

async function request(
  path: string,
  method: string,
  session?: ChatSession,
  conversation?: Conversation,
  signal?: AbortSignal,
) {
  if (!API_BASE_URL) {
    throw new ChatRequestError('chat_unavailable');
  }
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort);
  if (signal?.aborted) {
    controller.abort();
  }
  const timeout = setTimeout(abort, 10000);
  try {
    const response = await fetch(`${API_BASE_URL}/chat${path}`, {
      method,
      headers: headers(session, conversation),
      signal: controller.signal,
    });
    if (response.status === 204) {
      return null;
    }
    const body = await response.json();
    if (!response.ok) {
      throw new ChatRequestError(
        typeof body?.code === 'string' ? body.code : 'chat_unavailable',
      );
    }
    return body;
  } catch (error) {
    if (error instanceof ChatRequestError) {
      throw error;
    }
    throw new ChatRequestError(
      controller.signal.aborted
        ? signal?.aborted
          ? 'cancelled'
          : 'chat_timeout'
        : 'chat_unavailable',
    );
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}

const validConversation = (value: unknown): value is Conversation =>
  !!value &&
  typeof value === 'object' &&
  'id' in value &&
  typeof value.id === 'string' &&
  'title' in value &&
  typeof value.title === 'string';
export async function createConversation(
  session?: ChatSession,
  signal?: AbortSignal,
): Promise<Conversation> {
  const body = await request(
    '/conversations',
    'POST',
    session,
    undefined,
    signal,
  );
  if (
    !validConversation(body) ||
    (!session && typeof body.guestToken !== 'string')
  ) {
    throw new ChatRequestError('chat_unavailable');
  }
  return body;
}
export async function listConversations(
  session: ChatSession,
  signal?: AbortSignal,
): Promise<Conversation[]> {
  const body = await request(
    '/conversations',
    'GET',
    session,
    undefined,
    signal,
  );
  if (
    !Array.isArray(body?.conversations) ||
    !body.conversations.every(validConversation)
  ) {
    throw new ChatRequestError('chat_unavailable');
  }
  return body.conversations;
}
export async function getConversation(
  conversation: Conversation,
  session?: ChatSession,
  signal?: AbortSignal,
): Promise<ChatTurn[]> {
  const body = await request(
    `/conversations/${encodeURIComponent(conversation.id)}`,
    'GET',
    session,
    conversation,
    signal,
  );
  if (
    !Array.isArray(body?.turns) ||
    body.turns.length > 100 ||
    !body.turns.every(
      (turn: ChatTurn) =>
        turn &&
        typeof turn.requestId === 'string' &&
        typeof turn.userText === 'string' &&
        typeof turn.assistantText === 'string' &&
        ['pending', 'completed', 'failed'].includes(turn.status),
    )
  ) {
    throw new ChatRequestError('chat_unavailable');
  }
  return body.turns.map((turn: ChatTurn) => ({
    ...turn,
    status: turn.status === 'pending' ? 'failed' : turn.status,
  }));
}
export async function deleteConversation(
  conversation: Conversation,
  session?: ChatSession,
  signal?: AbortSignal,
) {
  await request(
    `/conversations/${encodeURIComponent(conversation.id)}`,
    'DELETE',
    session,
    conversation,
    signal,
  );
}

export function streamReply({
  conversation,
  session,
  message,
  requestId,
  language,
  signal,
  onText,
}: {
  conversation: Conversation;
  session?: ChatSession;
  message: string;
  requestId: string;
  language: string;
  signal: AbortSignal;
  onText: (text: string) => void;
}): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!API_BASE_URL) {
      reject(new ChatRequestError('chat_unavailable'));
      return;
    }
    const xhr = new XMLHttpRequest();
    let offset = 0,
      buffer = '',
      text = '',
      completed = false,
      settled = false;
    const abort = () => {
      finish(new ChatRequestError('cancelled'));
    };
    const finish = (error?: ChatRequestError) => {
      if (settled) {
        return;
      }
      settled = true;
      signal.removeEventListener('abort', abort);
      if (error) {
        xhr.abort();
        reject(error);
      } else {
        resolve(text);
      }
    };
    const consume = () => {
      if (xhr.responseText.length > 1048576) {
        throw new ChatRequestError('chat_unavailable');
      }
      buffer += xhr.responseText.slice(offset);
      offset = xhr.responseText.length;
      let end = buffer.indexOf('\n');
      while (end >= 0) {
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 1);
        if (line.trim()) {
          const event = JSON.parse(line);
          if (event.type === 'error') {
            throw new ChatRequestError(
              typeof event.code === 'string' ? event.code : 'chat_unavailable',
            );
          }
          if (event.type === 'delta') {
            if (
              completed ||
              typeof event.text !== 'string' ||
              text.length + event.text.length > 32000
            ) {
              throw new ChatRequestError('chat_unavailable');
            }
            text += event.text;
            onText(text);
          } else if (event.type === 'done') {
            if (
              event.requestId !== requestId ||
              typeof event.text !== 'string' ||
              !event.text.trim() ||
              event.text.length > 32000
            ) {
              throw new ChatRequestError('chat_unavailable');
            }
            text = event.text;
            completed = true;
            onText(text);
          } else if (event.type !== 'start') {
            throw new ChatRequestError('chat_unavailable');
          }
        }
        end = buffer.indexOf('\n');
      }
    };
    const progress = () => {
      if (settled || xhr.status !== 200) {
        return;
      }
      try {
        consume();
      } catch (error) {
        finish(
          error instanceof ChatRequestError
            ? error
            : new ChatRequestError('chat_unavailable'),
        );
      }
    };
    xhr.open(
      'POST',
      `${API_BASE_URL}/chat/conversations/${encodeURIComponent(
        conversation.id,
      )}/messages`,
    );
    for (const [key, value] of Object.entries(headers(session, conversation))) {
      xhr.setRequestHeader(key, value);
    }
    xhr.setRequestHeader('Accept', 'application/x-ndjson');
    xhr.timeout = 70000;
    xhr.onprogress = progress;
    xhr.onreadystatechange = () => {
      if (xhr.readyState === 3) {
        progress();
      }
    };
    xhr.onload = () => {
      if (settled) {
        return;
      }
      if (xhr.status !== 200) {
        let code = xhr.status === 429 ? 'rate_limited' : 'chat_unavailable';
        try {
          code = JSON.parse(xhr.responseText).code ?? code;
        } catch {}
        finish(new ChatRequestError(code));
        return;
      }
      progress();
      if (!settled) {
        finish(
          completed && !buffer.trim()
            ? undefined
            : new ChatRequestError('chat_unavailable'),
        );
      }
    };
    xhr.onerror = () => finish(new ChatRequestError('chat_unavailable'));
    xhr.ontimeout = () => finish(new ChatRequestError('chat_timeout'));
    xhr.onabort = () => finish(new ChatRequestError('cancelled'));
    signal.addEventListener('abort', abort);
    if (signal.aborted) {
      abort();
      return;
    }
    xhr.send(JSON.stringify({ message, requestId, language }));
  });
}
