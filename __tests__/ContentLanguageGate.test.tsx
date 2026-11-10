import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LanguageProvider } from '../src/i18n/LanguageProvider';
import ContentLanguageGate from '../src/i18n/ContentLanguageGate';
import { activateLanguage, LANGUAGE_STORAGE_KEY } from '../src/i18n/engine';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest'),
);
test('English educational content requires explicit consent under Hindi', async () => {
  await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, 'hi-Deva-IN');
  let app!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    app = ReactTestRenderer.create(
      <LanguageProvider>
        <ContentLanguageGate contentId="lesson-1" onCancel={jest.fn()}>
          <Text>Protected English lesson</Text>
        </ContentLanguageGate>
      </LanguageProvider>,
    );
  });
  const visible = () =>
    app.root
      .findAllByType(Text)
      .some(node => node.props.children === 'Protected English lesson');
  expect(visible()).toBe(false);
  await ReactTestRenderer.act(async () =>
    app.root
      .findAll(
        node =>
          node.props.accessibilityLabel === 'View content in English' &&
          node.props.onPress,
      )[0]
      .props.onPress(),
  );
  expect(visible()).toBe(true);
  await ReactTestRenderer.act(async () => app.unmount());
  await activateLanguage('en');
});
