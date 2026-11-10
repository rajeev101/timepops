import {
  categoryColumns,
  collectCourseIds,
  parseCatalog,
  resolvePath,
  searchCatalog,
} from '../src/catalog';

const catalog = parseCatalog(require('../backend/catalog'));

test('validates the API catalog and rejects broken references', () => {
  expect(catalog.categories).toHaveLength(5);
  expect(() => parseCatalog({ ...catalog, courses: [] })).toThrow(
    'Invalid catalog response',
  );
  expect(() =>
    parseCatalog({
      ...catalog,
      categories: [catalog.categories[0], catalog.categories[0]],
    }),
  ).toThrow('Invalid catalog response');
});

test('all requested example paths resolve through the same tree', () => {
  const examples = [
    ['All Schools', 'Class 10', 'Mathematics', 'Chapter 1: Real Numbers'],
    ['Government Entrance Exams', 'UPSC', 'General Studies', 'Indian Polity'],
    ['Computer Learning', 'Programming', 'Python', 'Python for Beginners'],
    ['English Learning', 'Spoken English', 'Beginner', 'Daily Lessons'],
    ['Colleges', 'BCA', 'Semester 1', 'Programming Fundamentals'],
  ];
  for (const titles of examples) {
    let children = catalog.categories;
    const path = titles.map(title => {
      const entry = children.find(child => child.title === title)!;
      expect(entry).toBeDefined();
      children = entry.children;
      return entry.id;
    });
    const resolved = resolvePath(catalog.categories, path);
    expect(resolved.map(entry => entry.title)).toEqual(titles);
    expect(
      catalog.courses.some(course => course.id === resolved.at(-1)?.courseId),
    ).toBe(true);
  }
});

test('search discovers nested topics and course scope is deduplicated', () => {
  expect(
    searchCatalog(catalog.categories, '  python  ').some(
      match => match.node.title === 'Python',
    ),
  ).toBe(true);
  expect(searchCatalog(catalog.categories, 'missing subject')).toEqual([]);
  expect([...collectCourseIds(catalog.categories[1])]).toEqual([
    'class10-math',
  ]);
});

test.each([
  [360, 2],
  [768, 3],
  [1200, 4],
  [1500, 5],
])('category grid at width %i uses %i columns', (width, columns) => {
  expect(categoryColumns(width)).toBe(columns);
});
