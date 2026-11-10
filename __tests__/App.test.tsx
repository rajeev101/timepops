import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {Image} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {LANGUAGE_STORAGE_KEY} from '../src/i18n/engine';
import App from '../App';
import { getCatalog } from '../src/api';
import { parseCatalog } from '../src/catalog';

jest.mock('../src/api');
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest'),
);

let app: ReactTestRenderer.ReactTestRenderer;

beforeEach(async () => {
  await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, 'en-Latn-IN');
  jest
    .mocked(getCatalog)
    .mockResolvedValue(parseCatalog(require('../backend/catalog')));
  await ReactTestRenderer.act(async () => {
    app = ReactTestRenderer.create(<App />);
  });
});

afterEach(async () => {
  await ReactTestRenderer.act(() => app.unmount());
});

const button = (label: string) =>
  app.root.findAll(
    node =>
      node.props.accessibilityLabel === label &&
      typeof node.props.onPress === 'function',
  )[0];

test('opens the category-based Explore experience on launch', () => {
  expect(button('Explore English Learning')).toBeDefined();
  expect(button('Explore All Schools')).toBeDefined();
  expect(button('Explore Government Entrance Exams')).toBeDefined();
  expect(button('Explore Colleges')).toBeDefined();
  expect(button('Explore Computer Learning')).toBeDefined();
});

test('shows bharatshiksak branding while preserving the native registration name', () => {
  expect(require('../app.json')).toEqual({name: 'RNApp', displayName: 'bharatshiksak'});
  expect(JSON.stringify(app.toJSON())).toContain('bharatshiksak');
  expect(JSON.stringify(app.toJSON())).not.toContain('StudentAI');
  const logo = app.root.findAllByType(Image).find(node => node.props.accessibilityLabel === 'bharatshiksak logo');
  expect(logo?.props.source).toEqual(require('../assets/brand/logo.png'));
  expect(logo?.props.resizeMode).toBe('contain');
});

test('preserves existing study and profile navigation', async () => {
  await ReactTestRenderer.act(async () => button('Study').props.onPress());
  expect(button('Explore English Learning')).toBeUndefined();
  await ReactTestRenderer.act(async () => button('Explore').props.onPress());
  expect(button('Explore English Learning')).toBeDefined();
  await ReactTestRenderer.act(async () =>
    button('Open profile').props.onPress(),
  );
  expect(button('Explore English Learning')).toBeUndefined();
});

test('keeps the branded chat and its draft intact when changing tabs',async()=>{
  await ReactTestRenderer.act(async()=>button('Chat').props.onPress());
  const composer=()=>app.root.findAll(node=>node.props.accessibilityLabel==='Ask BharatShikshak AI...'&&typeof node.props.onChangeText==='function')[0];
  await ReactTestRenderer.act(async()=>composer().props.onChangeText('A follow-up draft'));
  await ReactTestRenderer.act(async()=>button('Explore').props.onPress());
  await ReactTestRenderer.act(async()=>button('Chat').props.onPress());
  expect(composer().props.value).toBe('A follow-up draft');
  await ReactTestRenderer.act(async()=>button('Change language').props.onPress());
  await ReactTestRenderer.act(async()=>button('Close language settings').props.onPress());
  expect(composer().props.value).toBe('A follow-up draft');
  expect(JSON.stringify(app.toJSON())).toContain('BharatShikshak AI');
  expect(JSON.stringify(app.toJSON())).not.toContain('Message Mia');
});
