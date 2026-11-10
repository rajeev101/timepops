import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Pressable, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LanguageProvider, useLanguage } from '../src/i18n/LanguageProvider';
import { activateLanguage, LANGUAGE_STORAGE_KEY } from '../src/i18n/engine';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest'),
);
let app: ReactTestRenderer.ReactTestRenderer;
function Probe() {
  const { language, ready, selecting, rtl, selectLanguage, openSelector, t } =
    useLanguage();
  return (
    <>
      <Text>
        {JSON.stringify({
          code: language.code,
          ready,
          selecting,
          rtl,
          label: t('ui.study'),
        })}
      </Text>
      <Pressable
        accessibilityLabel="Hindi"
        onPress={() => selectLanguage('hi')}
      />
      <Pressable
        accessibilityLabel="Urdu"
        onPress={() => selectLanguage('ur')}
      />
      <Pressable accessibilityLabel="Settings" onPress={openSelector} />
    </>
  );
}
const state = () => JSON.parse(app.root.findByType(Text).props.children);
const press = async (label: string) => {
  await ReactTestRenderer.act(async () =>
    app.root
      .findAll(
        node => node.props.accessibilityLabel === label && node.props.onPress,
      )[0]
      .props.onPress(),
  );
};
beforeEach(async () => {
  await AsyncStorage.clear();
  await activateLanguage('en');
});
afterEach(async () => {
  if (app) {
    await ReactTestRenderer.act(async () => app.unmount());
  }
  await activateLanguage('en');
});

test('first launch asks once, then persists language across restart and settings changes', async () => {
  await ReactTestRenderer.act(async () => {
    app = ReactTestRenderer.create(
      <LanguageProvider>
        <Probe />
      </LanguageProvider>,
    );
  });
  expect(state().selecting).toBe(true);
  await press('Hindi');
  expect(state()).toMatchObject({
    code: 'hi',
    selecting: false,
    label: 'पढ़ाई',
  });
  expect(await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('hi-Deva-IN');
  await ReactTestRenderer.act(async () => {
    app.unmount();
    app = ReactTestRenderer.create(
      <LanguageProvider>
        <Probe />
      </LanguageProvider>,
    );
  });
  expect(state()).toMatchObject({ code: 'hi', selecting: false });
  await press('Settings');
  expect(state().selecting).toBe(true);
  await press('Urdu');
  expect(state()).toMatchObject({ code: 'ur', rtl: true, selecting: false });
});

test('authenticated profile adapter receives the BCP 47 preference', async () => {
  const savePreferredLanguage = jest.fn().mockResolvedValue(undefined);
  await ReactTestRenderer.act(async () => {
    app = ReactTestRenderer.create(
      <LanguageProvider
        profile={{ preferredLanguage: 'hi-Deva-IN', savePreferredLanguage }}
      >
        <Probe />
      </LanguageProvider>,
    );
  });
  expect(state().code).toBe('hi');
  await press('Urdu');
  expect(savePreferredLanguage).toHaveBeenCalledWith('ur-Arab-IN');
});
