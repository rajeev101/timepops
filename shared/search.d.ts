export function normalizeSearch(query: string): {
  terms: string[];
  languages: string[];
};
export function matchesSearch(text: string, query: string): boolean;
