import { streamReply, ChatRequestError } from '../src/chat/api';

class FakeXHR {
  static current: FakeXHR;
  status = 200;
  readyState = 3;
  responseText = '';
  timeout = 0;
  onprogress = () => {};
  onreadystatechange = () => {};
  onload = () => {};
  onerror = () => {};
  ontimeout = () => {};
  onabort = () => {};
  open = jest.fn();
  setRequestHeader = jest.fn();
  send = jest.fn();
  abort = jest.fn();
  constructor() {
    FakeXHR.current = this;
  }
}
const original = globalThis.XMLHttpRequest;
beforeEach(() => {
  globalThis.XMLHttpRequest = FakeXHR as unknown as typeof XMLHttpRequest;
});
afterEach(() => {
  globalThis.XMLHttpRequest = original;
});
const input = () => ({
  conversation: {
    id: 'conversation',
    title: 'Chat',
    guestToken: 'guest-capability',
  },
  message: 'Hello',
  requestId: 'request',
  language: 'en-Latn-IN',
  signal: new AbortController().signal,
  onText: jest.fn(),
});

test('streams partial NDJSON frames without duplicating text and accepts the completed reply', async () => {
  const options = input();
  const result = streamReply(options);
  const xhr = FakeXHR.current;
  xhr.responseText =
    '{"type":"delta","text":"Hello"}\n{"type":"delta","text":" ';
  xhr.onprogress();
  expect(options.onText).toHaveBeenLastCalledWith('Hello');
  xhr.responseText +=
    'world"}\n{"type":"done","text":"Hello world","requestId":"request"}\n';
  xhr.onprogress();
  xhr.onload();
  await expect(result).resolves.toBe('Hello world');
  expect(xhr.setRequestHeader).toHaveBeenCalledWith(
    'X-Chat-Guest',
    'guest-capability',
  );
});
test('handles rate limits without rendering backend error details', async () => {
  const result = streamReply(input());
  const xhr = FakeXHR.current;
  xhr.status = 429;
  xhr.responseText = '{"code":"rate_limited"}';
  xhr.onload();
  await expect(result).rejects.toMatchObject({ code: 'rate_limited' });
});
test('cancellation aborts the request and a truncated stream never succeeds', async () => {
  const controller = new AbortController();
  const first = streamReply({ ...input(), signal: controller.signal });
  controller.abort();
  await expect(first).rejects.toMatchObject({ code: 'cancelled' });
  expect(FakeXHR.current.abort).toHaveBeenCalled();
  const second = streamReply(input());
  FakeXHR.current.responseText = '{"type":"delta","text":"Incomplete"}\n';
  FakeXHR.current.onload();
  await expect(second).rejects.toBeInstanceOf(ChatRequestError);
});
