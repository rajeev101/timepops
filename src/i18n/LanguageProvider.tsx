import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { I18nextProvider, useTranslation } from 'react-i18next';
import {
  activateLanguage,
  i18n,
  LANGUAGE_STORAGE_KEY,
  resolveLanguage,
  type AppLanguage,
} from './engine';

interface ProfileLanguageAdapter {
  preferredLanguage?: string | null;
  savePreferredLanguage: (locale: string) => Promise<void>;
}
interface LanguageState {
  language: AppLanguage;
  ready: boolean;
  selecting: boolean;
  saving: boolean;
  error: string | null;
  openSelector: () => void;
  dismissSelector: () => void;
  selectLanguage: (code: string) => Promise<void>;
}
const defaultState: LanguageState = {
  language: resolveLanguage('en'),
  ready: true,
  selecting: false,
  saving: false,
  error: null,
  openSelector: () => {},
  dismissSelector: () => {},
  selectLanguage: async code => {
    await activateLanguage(code);
  },
};
const LanguageContext = createContext<LanguageState>(defaultState);

export function LanguageProvider({
  children,
  profile,
}: {
  children: React.ReactNode;
  profile?: ProfileLanguageAdapter;
}) {
  const [language, setLanguage] = useState(resolveLanguage('en'));
  const [ready, setReady] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [hasPreference, setHasPreference] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(LANGUAGE_STORAGE_KEY)
      .then(async local => {
        const preference = profile?.preferredLanguage ?? local;
        const next = await activateLanguage(preference ?? 'en');
        if (active) {
          setLanguage(next);
          setHasPreference(!!preference);
          setSelecting(!preference);
        }
      })
      .catch(() => {
        if (active) {
          setSelecting(true);
          setError(String(i18n.t('ui.preferenceError')));
        }
      })
      .finally(() => {
        if (active) {
          setReady(true);
        }
      });
    return () => {
      active = false;
    };
  }, [profile?.preferredLanguage]);

  const selectLanguage = async (code: string) => {
    if (saving) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const next = resolveLanguage(code);
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, next.locale);
      await activateLanguage(next.code);
      setLanguage(next);
      setHasPreference(true);
      setSelecting(false);
      if (profile) {
        try {
          await profile.savePreferredLanguage(next.locale);
        } catch {
          setError(String(i18n.t('ui.accountSyncError')));
        }
      }
    } catch {
      setError(String(i18n.t('ui.preferenceError')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <I18nextProvider i18n={i18n}>
      <LanguageContext.Provider
        value={{
          language,
          ready,
          selecting,
          saving,
          error,
          selectLanguage,
          openSelector: () => setSelecting(true),
          dismissSelector: () => {
            if (hasPreference) {
              setSelecting(false);
            }
          },
        }}
      >
        {children}
      </LanguageContext.Provider>
    </I18nextProvider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  const { t } = useTranslation(undefined, { i18n });
  const rtl = context.language.direction === 'rtl';
  return {
    ...context,
    t,
    rtl,
    textStyle: {
      fontFamily: context.language.font,
      textAlign: rtl ? ('right' as const) : ('left' as const),
      writingDirection: rtl ? ('rtl' as const) : ('ltr' as const),
    },
    rowStyle: {
      flexDirection: rtl ? ('row-reverse' as const) : ('row' as const),
    },
  };
}
