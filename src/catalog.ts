import { matchesSearch } from '../shared/search';

export interface CatalogNode {
  id: string;
  title: string;
  description?: string;
  children: CatalogNode[];
  formats: string[];
  courseId?: string;
}

export interface Course {
  id: string;
  title: string;
  categoryId: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  summary: string;
  imageUrl: string;
  featured: boolean;
  popular: boolean;
  resources: string[];
  units: string[];
  contentLanguage?: string;
  availableLanguages?: string[];
}

export interface Catalog {
  version: number;
  contentStatus: 'preview';
  categories: CatalogNode[];
  courses: Course[];
  requestedLanguage?: string;
  contentLanguage?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const isText = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;
const isTextList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(isText);

export function parseCatalog(value: unknown): Catalog {
  const invalid = () => {
    throw new Error('Invalid catalog response');
  };
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    value.contentStatus !== 'preview' ||
    !Array.isArray(value.categories) ||
    !Array.isArray(value.courses)
  ) {
    return invalid();
  }
  const nodeIds = new Set<string>();
  const courseLinks: string[] = [];
  const validateNode = (entry: unknown, depth: number): boolean => {
    if (
      !isRecord(entry) ||
      depth > 12 ||
      !isText(entry.id) ||
      nodeIds.has(entry.id) ||
      !isText(entry.title) ||
      !isTextList(entry.formats) ||
      !Array.isArray(entry.children) ||
      (entry.description !== undefined && !isText(entry.description)) ||
      (entry.courseId !== undefined && !isText(entry.courseId))
    ) {
      return false;
    }
    nodeIds.add(entry.id);
    if (typeof entry.courseId === 'string') {
      courseLinks.push(entry.courseId);
    }
    return entry.children.every(child => validateNode(child, depth + 1));
  };
  if (!value.categories.every(entry => validateNode(entry, 0))) {
    return invalid();
  }
  const categoryIds = new Set(
    value.categories.map(entry => (entry as CatalogNode).id),
  );
  const courseIds = new Set<string>();
  for (const course of value.courses) {
    if (
      !isRecord(course) ||
      !['id', 'title', 'categoryId', 'summary', 'imageUrl'].every(key =>
        isText(course[key]),
      ) ||
      !categoryIds.has(String(course.categoryId)) ||
      courseIds.has(String(course.id)) ||
      !['Beginner', 'Intermediate', 'Advanced'].includes(
        String(course.level),
      ) ||
      typeof course.featured !== 'boolean' ||
      typeof course.popular !== 'boolean' ||
      !isTextList(course.resources) ||
      !isTextList(course.units) ||
      !String(course.imageUrl).startsWith('https://')
    ) {
      return invalid();
    }
    courseIds.add(String(course.id));
  }
  if (!courseLinks.every(id => courseIds.has(id))) {
    return invalid();
  }
  return value as unknown as Catalog;
}

export function resolvePath(
  categories: CatalogNode[],
  path: string[],
): CatalogNode[] {
  const result: CatalogNode[] = [];
  let children = categories;
  for (const id of path) {
    const entry = children.find(child => child.id === id);
    if (!entry) {
      break;
    }
    result.push(entry);
    children = entry.children;
  }
  return result;
}

export function searchCatalog(categories: CatalogNode[], query: string) {
  const matches: { node: CatalogNode; path: string[]; trail: string }[] = [];
  const visit = (nodes: CatalogNode[], path: string[], titles: string[]) => {
    for (const entry of nodes) {
      const nextPath = [...path, entry.id];
      if (matchesSearch(`${entry.title} ${entry.description ?? ''}`, query)) {
        matches.push({
          node: entry,
          path: nextPath,
          trail: titles.join(' / '),
        });
      }
      visit(entry.children, nextPath, [...titles, entry.title]);
    }
  };
  if (query.trim()) {
    visit(categories, [], []);
  }
  return matches;
}

export function collectCourseIds(entry: CatalogNode): Set<string> {
  const ids = new Set<string>(entry.courseId ? [entry.courseId] : []);
  entry.children.forEach(child =>
    collectCourseIds(child).forEach(id => ids.add(id)),
  );
  return ids;
}

export function categoryColumns(width: number): number {
  return width >= 1400 ? 5 : width >= 1100 ? 4 : width >= 720 ? 3 : 2;
}
