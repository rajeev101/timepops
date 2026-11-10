import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text, TextInput } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ExploreHome from '../src/ExploreHome';
import { getCatalog } from '../src/api';
import { parseCatalog } from '../src/catalog';

jest.mock('../src/api');
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest'),
);

const catalog = parseCatalog(require('../backend/catalog'));
const mockGetCatalog = jest.mocked(getCatalog);
let app: ReactTestRenderer.ReactTestRenderer;
const button = (label: string) =>
  app.root.findAll(
    node =>
      node.props.accessibilityLabel === label &&
      typeof node.props.onPress === 'function',
  )[0];
const press = async (label: string) => {
  await ReactTestRenderer.act(async () => button(label).props.onPress());
};
const hasText = (text: string) =>
  app.root.findAllByType(Text).some(node => node.props.children === text);

beforeEach(async () => {
  await AsyncStorage.clear();
  mockGetCatalog.mockReset().mockResolvedValue(catalog);
  await ReactTestRenderer.act(async () => {
    app = ReactTestRenderer.create(<ExploreHome onAccountPress={jest.fn()} />);
  });
});
afterEach(async () => {
  await ReactTestRenderer.act(async () => app.unmount());
});

test('all five primary category cards are clickable', async () => {
  for (const category of catalog.categories) {
    expect(button(`Explore ${category.title}`)).toBeDefined();
    await press(`Explore ${category.title}`);
    expect(hasText(category.title)).toBe(true);
    expect(button(`Browse ${category.children[0].title}`)).toBeDefined();
    await press('Explore home');
  }
});

test('navigates dynamically to Python resources without building lesson modules', async () => {
  await press('Explore Computer Learning');
  await press('Browse Programming');
  await press('Browse Python');
  await press('Browse Python for Beginners');
  expect(hasText('Python for Beginners')).toBe(true);
  await press('Resource Exercises');
  expect(hasText('Exercises content has not been published yet.')).toBe(true);
});

test('search finds nested topics and level filters course results', async () => {
  await ReactTestRenderer.act(async () =>
    app.root.findByType(TextInput).props.onChangeText('python'),
  );
  expect(button('Browse Python')).toBeDefined();
  expect(button('Open Python for Beginners')).toBeDefined();
  await press('Filter Advanced');
  expect(button('Open Python for Beginners')).toBeUndefined();
});

test('bookmarks survive a remount and recent views are recorded', async () => {
  await press('Save Python for Beginners');
  await press('Open Python for Beginners');
  await press('Recent courses');
  expect(button('Open Python for Beginners')).toBeDefined();
  await ReactTestRenderer.act(async () => {
    app.unmount();
    app = ReactTestRenderer.create(<ExploreHome onAccountPress={jest.fn()} />);
  });
  await press('Saved courses');
  expect(button('Open Python for Beginners')).toBeDefined();
  await press('Unsave Python for Beginners');
  expect(button('Open Python for Beginners')).toBeUndefined();
});

test('failed catalog requests can be retried', async () => {
  mockGetCatalog.mockRejectedValueOnce(new Error('Offline'));
  await ReactTestRenderer.act(async () => {
    app.unmount();
    app = ReactTestRenderer.create(<ExploreHome onAccountPress={jest.fn()} />);
  });
  expect(button('Retry catalog')).toBeDefined();
  await press('Retry catalog');
  expect(button('Explore English Learning')).toBeDefined();
});

test('loading and no-result states do not present invented courses', async () => {
  await ReactTestRenderer.act(async () =>
    app.root.findByType(TextInput).props.onChangeText('no-such-course'),
  );
  expect(hasText('No results. Try a different subject or course.')).toBe(true);
  mockGetCatalog.mockImplementationOnce(() => new Promise(() => {}));
  await ReactTestRenderer.act(async () => {
    app.unmount();
    app = ReactTestRenderer.create(<ExploreHome onAccountPress={jest.fn()} />);
  });
  expect(
    app.root.findAll(
      node => node.props.accessibilityLabel === 'Loading catalog',
    ).length,
  ).toBeGreaterThan(0);
  expect(button('Explore English Learning')).toBeUndefined();
});

test('Continue Learning appears only for an authenticated identity with a last-opened resource', async () => {
  expect(hasText('Continue Learning')).toBe(false);
  await AsyncStorage.setItem(
    'studentai:library:v1:learner-1',
    JSON.stringify({
      saved: [],
      recent: ['python'],
      lastOpened: { python: 'Exercises' },
    }),
  );
  await ReactTestRenderer.act(async () => {
    app.unmount();
    app = ReactTestRenderer.create(
      <ExploreHome
        user={{ id: 'learner-1', name: 'Alex' }}
        onAccountPress={jest.fn()}
      />,
    );
  });
  expect(hasText('Continue Learning')).toBe(true);
  await press('Open Python for Beginners');
  expect(hasText('Exercises content has not been published yet.')).toBe(true);
});
