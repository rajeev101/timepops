import { getCatalog, getSubjects, getLessonContent } from '../src/api';

const originalFetch = globalThis.fetch;
const mockFetch = jest.fn();
const subjects = [
  { id: 'math', title: 'Mathematics', subject: 'Math', detail: 'Algebra' },
];

beforeEach(() => {
  mockFetch.mockReset();
  globalThis.fetch = mockFetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test('fetches subjects and forwards the cancellation signal', async () => {
  const signal = new AbortController().signal;
  mockFetch.mockResolvedValue({ ok: true, json: async () => ({ subjects }) });
  await expect(getSubjects(signal)).resolves.toEqual(subjects);
  expect(mockFetch).toHaveBeenCalledWith('http://127.0.0.1:3000/api/subjects', {
    signal,
  });
});

test('rejects unsuccessful HTTP responses', async () => {
  mockFetch.mockResolvedValue({ ok: false, status: 503 });
  await expect(getSubjects(new AbortController().signal)).rejects.toThrow(
    'Subjects request failed (503)',
  );
});

test.each([
  null,
  { subjects: null },
  { subjects: [{ ...subjects[0], id: 'unsupported' }] },
  { subjects: [{ ...subjects[0], title: 12 }] },
  { subjects: [subjects[0], subjects[0]] },
])('rejects malformed or duplicate subject data: %p', async payload => {
  mockFetch.mockResolvedValue({ ok: true, json: async () => payload });
  await expect(getSubjects(new AbortController().signal)).rejects.toThrow(
    'Invalid subjects response',
  );
});

test('propagates network errors', async () => {
  mockFetch.mockRejectedValue(new Error('Network request failed'));
  await expect(getSubjects(new AbortController().signal)).rejects.toThrow(
    'Network request failed',
  );
});

test('catalog requests use the API route and validate the response', async () => {
  const catalog = require('../backend/catalog');
  const signal = new AbortController().signal;
  mockFetch.mockResolvedValue({ ok: true, json: async () => catalog });
  await expect(getCatalog(signal)).resolves.toEqual(catalog);
  expect(mockFetch).toHaveBeenCalledWith('http://127.0.0.1:3000/api/catalog', {
    signal,
  });
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ categories: [] }),
  });
  await expect(getCatalog(signal)).rejects.toThrow('Invalid catalog response');
});

test('lesson translations require explicit English fallback consent', async () => {
  const content = {
    title: 'English lesson',
    description: '',
    content: 'Reviewed text',
    video_url: null,
    document_url: null,
    subtitle_url: null,
  };
  mockFetch.mockResolvedValue({
    status: 200,
    json: async () => ({
      available: true,
      contentLanguage: 'en-Latn-IN',
      content,
    }),
  });
  const signal = new AbortController().signal;
  await expect(
    getLessonContent('lesson', 'hi-Deva-IN', signal),
  ).rejects.toThrow('unapproved language fallback');
  await expect(
    getLessonContent('lesson', 'hi-Deva-IN', signal, true),
  ).resolves.toMatchObject({ available: true, contentLanguage: 'en-Latn-IN' });
  expect(mockFetch).toHaveBeenLastCalledWith(
    'http://127.0.0.1:3000/api/lessons/lesson/content?language=hi-Deva-IN&fallback=en',
    { signal },
  );
});

test('unavailable lessons expose a consent prompt without English content', async () => {
  mockFetch.mockResolvedValue({
    status: 409,
    json: async () => ({
      available: false,
      code: 'translation_unavailable',
      availableLanguages: ['en-Latn-IN'],
      fallbackRequiresConsent: true,
    }),
  });
  await expect(
    getLessonContent('lesson', 'hi-Deva-IN', new AbortController().signal),
  ).resolves.toEqual({
    available: false,
    availableLanguages: ['en-Latn-IN'],
    fallbackRequiresConsent: true,
  });
});

test('catalog metadata caches remain separate for each locale', async () => {
  const catalog = require('../backend/catalog');
  mockFetch.mockResolvedValue({ ok: true, json: async () => catalog });
  const signal = new AbortController().signal;
  await getCatalog(signal, 'hi-Deva-IN', true);
  await getCatalog(signal, 'hi-Deva-IN');
  expect(mockFetch).toHaveBeenCalledTimes(1);
  await getCatalog(signal, 'ur-Arab-IN', true);
  expect(mockFetch).toHaveBeenCalledTimes(2);
});
