const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const app = require('./app');

let server;
let baseUrl;

before(async () => {
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close(error => (error ? reject(error) : resolve()));
  });
});

test('health endpoint responds with JSON', async () => {
  const response = await fetch(`${baseUrl}/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok' });
});

test('subjects endpoint returns the study catalog', async () => {
  const response = await fetch(`${baseUrl}/subjects`);
  assert.equal(response.status, 200);
  const { subjects } = await response.json();
  assert.deepEqual(
    subjects.map(subject => subject.id),
    ['math', 'physics', 'english'],
  );
  assert.ok(
    subjects.every(
      subject => subject.title && subject.subject && subject.detail,
    ),
  );
});

test('unknown endpoints return a JSON 404', async () => {
  const response = await fetch(`${baseUrl}/missing`);
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: 'Endpoint not found' });
});

test('catalog contains all five category trees and valid course links', async () => {
  const response = await fetch(`${baseUrl}/catalog`);
  assert.equal(response.status, 200);
  const catalog = await response.json();
  assert.deepEqual(
    catalog.categories.map(category => category.title),
    [
      'English Learning',
      'All Schools',
      'Government Entrance Exams',
      'Colleges',
      'Computer Learning',
    ],
  );
  const ids = new Set();
  const courseIds = new Set(catalog.courses.map(course => course.id));
  const visit = entry => {
    assert.ok(!ids.has(entry.id), `Duplicate node: ${entry.id}`);
    ids.add(entry.id);
    if (entry.courseId) {
      assert.ok(courseIds.has(entry.courseId));
    }
    entry.children.forEach(visit);
  };
  catalog.categories.forEach(visit);
  assert.equal(catalog.contentStatus, 'preview');
  assert.equal(catalog.categories[0].children.length, 11);
  assert.equal(catalog.categories[2].children.length, 18);
  assert.equal(catalog.categories[3].children.length, 13);
  const schools = catalog.categories[1];
  assert.equal(
    schools.children.filter(child => /^Class \d+$/.test(child.title)).length,
    12,
  );
  const python = catalog.categories[4].children
    .find(child => child.title === 'Programming')
    .children.find(child => child.title === 'Python');
  assert.equal(python.children[0].courseId, 'python');
});
