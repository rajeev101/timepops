import { parseCatalog, type Catalog } from './catalog';

export interface Subject {
  id: 'math' | 'physics' | 'english';
  title: string;
  subject: string;
  detail: string;
}

export const API_BASE_URL =
  'https://classroom-api.201.18.199.107.sslip.io/api';
const catalogCache = new Map<string, { catalog: Catalog; expires: number }>();

export type LessonResult =
  | {
      available: false;
      availableLanguages: string[];
      fallbackRequiresConsent: boolean;
    }
  | {
      available: true;
      contentLanguage: string;
      content: {
        title: string;
        description: string;
        content: string;
        video_url: string | null;
        document_url: string | null;
        subtitle_url: string | null;
      };
    };

export async function getLessonContent(
  id: string,
  locale: string,
  signal: AbortSignal,
  allowEnglish = false,
): Promise<LessonResult> {
  if (!API_BASE_URL) {
    throw new Error(
      'Configure an HTTPS API URL before creating a release build',
    );
  }
  const response = await fetch(
    `${API_BASE_URL}/lessons/${encodeURIComponent(
      id,
    )}/content?language=${encodeURIComponent(locale)}${
      allowEnglish ? '&fallback=en' : ''
    }`,
    { signal },
  );
  if (![200, 404, 409].includes(response.status)) {
    throw new Error(`Lesson request failed (${response.status})`);
  }
  const result = await response.json();
  if (
    result.available === false &&
    result.code === 'translation_unavailable' &&
    Array.isArray(result.availableLanguages) &&
    result.availableLanguages.every(
      (entry: unknown) => typeof entry === 'string',
    ) &&
    typeof result.fallbackRequiresConsent === 'boolean'
  ) {
    return {
      available: false,
      availableLanguages: result.availableLanguages,
      fallbackRequiresConsent: result.fallbackRequiresConsent,
    };
  }
  if (
    response.status !== 200 ||
    result.available !== true ||
    (result.contentLanguage !== locale &&
      !(allowEnglish && result.contentLanguage === 'en-Latn-IN')) ||
    !result.content ||
    ['title', 'description', 'content'].some(
      key => typeof result.content[key] !== 'string',
    ) ||
    ['video_url', 'document_url', 'subtitle_url'].some(
      key =>
        result.content[key] !== null &&
        (typeof result.content[key] !== 'string' ||
          !result.content[key].startsWith('https://')),
    )
  ) {
    throw new Error('Invalid lesson response or unapproved language fallback');
  }
  return result;
}

export function profileLanguageAdapter(
  accessToken: string,
  preferredLanguage?: string | null,
) {
  return {
    preferredLanguage,
    savePreferredLanguage: async (locale: string) => {
      if (!API_BASE_URL || !accessToken) {
        throw new Error('An authenticated API session is required');
      }
      const response = await fetch(`${API_BASE_URL}/me/language`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ language: locale }),
      });
      if (!response.ok) {
        throw new Error('Account language synchronization failed');
      }
    },
  };
}

function isSubject(value: unknown): value is Subject {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const subject = value as Record<string, unknown>;
  return (
    ['math', 'physics', 'english'].includes(String(subject.id)) &&
    ['title', 'subject', 'detail'].every(
      key => typeof subject[key] === 'string' && subject[key].trim().length > 0,
    )
  );
}

export async function getSubjects(signal: AbortSignal): Promise<Subject[]> {
  if (!API_BASE_URL) {
    throw new Error(
      'Configure an HTTPS API URL before creating a release build',
    );
  }
  const response = await fetch(`${API_BASE_URL}/subjects`, { signal });
  if (!response.ok) {
    throw new Error(`Subjects request failed (${response.status})`);
  }
  const payload: unknown = await response.json();
  if (
    !payload ||
    typeof payload !== 'object' ||
    !('subjects' in payload) ||
    !Array.isArray(payload.subjects) ||
    !payload.subjects.every(isSubject) ||
    new Set(payload.subjects.map(subject => subject.id)).size !==
      payload.subjects.length
  ) {
    throw new Error('Invalid subjects response');
  }
  return payload.subjects;
}

export async function getCatalog(
  signal: AbortSignal,
  locale?: string,
  force = false,
): Promise<Catalog> {
  if (!API_BASE_URL) {
    throw new Error(
      'Configure an HTTPS API URL before creating a release build',
    );
  }
  if (signal.aborted) {
    throw new Error('Catalog request cancelled');
  }
  const cached = locale ? catalogCache.get(locale) : undefined;
  if (!force && cached && cached.expires > Date.now()) {
    return cached.catalog;
  }
  const response = await fetch(
    `${API_BASE_URL}/catalog${
      locale ? `?language=${encodeURIComponent(locale)}` : ''
    }`,
    { signal },
  );
  if (!response.ok) {
    throw new Error(`Catalog request failed (${response.status})`);
  }
  const catalog = parseCatalog(await response.json());
  if (locale) {
    catalogCache.set(locale, { catalog, expires: Date.now() + 300000 });
  }
  return catalog;
}
