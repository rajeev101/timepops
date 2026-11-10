import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Check, Globe2, Search, X } from 'lucide-react-native';
import { languageRegistry } from './engine';
import { useLanguage } from './LanguageProvider';

export default function LanguageSelector() {
  const {
    language,
    t,
    textStyle,
    rowStyle,
    saving,
    error,
    selectLanguage,
    dismissSelector,
  } = useLanguage();
  const [selected, setSelected] = useState(language.code);
  const [query, setQuery] = useState('');
  const languages = languageRegistry.filter(entry =>
    `${entry.name} ${entry.nativeName} ${entry.code}`
      .toLocaleLowerCase()
      .includes(query.trim().toLocaleLowerCase()),
  );
  return (
    <View style={styles.screen}>
      <View style={[styles.header, rowStyle]}>
        <View style={styles.logo}>
          <Globe2 size={26} color="#24745A" />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close language settings"
          onPress={dismissSelector}
          style={styles.icon}
        >
          <X size={22} color="#20322E" />
        </Pressable>
      </View>
      <Text accessibilityRole="header" style={[styles.title, textStyle]}>
        {t('ui.chooseLanguage')}
      </Text>
      <Text style={[styles.subtitle, textStyle]}>
        {t('ui.languageSubtitle')}
      </Text>
      <View style={[styles.search, rowStyle]}>
        <Search size={20} color="#64736D" />
        <TextInput
          accessibilityLabel="Search language"
          placeholder={String(t('ui.searchLanguages'))}
          value={query}
          onChangeText={setQuery}
          style={[styles.input, textStyle]}
        />
      </View>
      <ScrollView
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
      >
        <View accessibilityRole="radiogroup">
          {languages.map(entry => (
            <Pressable
              key={entry.code}
              accessibilityRole="radio"
              accessibilityLabel={`${entry.name}, ${entry.nativeName}`}
              accessibilityState={{ checked: selected === entry.code }}
              onPress={() => setSelected(entry.code)}
              style={[
                styles.language,
                entry.direction === 'rtl' ? styles.rtlRow : styles.ltrRow,
                selected === entry.code && styles.selected,
              ]}
            >
              <View style={styles.flex}>
                <Text
                  style={[
                    styles.nativeName,
                    {
                      fontFamily: entry.font,
                      writingDirection: entry.direction as 'ltr' | 'rtl',
                    },
                    entry.direction === 'rtl' ? styles.rtlText : styles.ltrText,
                  ]}
                >
                  {entry.nativeName}
                </Text>
                <Text style={styles.englishName}>
                  {entry.name} · {entry.script}
                </Text>
              </View>
              {selected === entry.code && <Check size={21} color="#24745A" />}
            </Pressable>
          ))}
        </View>
        {!languages.length && (
          <Text style={styles.subtitle}>{t('ui.noResults')}</Text>
        )}
      </ScrollView>
      {error && (
        <Text accessibilityRole="alert" style={[styles.error, textStyle]}>
          {error}
        </Text>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Confirm language"
        accessibilityState={{ disabled: saving }}
        disabled={saving}
        onPress={() => selectLanguage(selected)}
        style={styles.continue}
      >
        {saving ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={[styles.continueText, { fontFamily: language.font }]}>
            {t('ui.continue')}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  rtlRow: {flexDirection:'row-reverse'},
  ltrRow: {flexDirection:'row'},
  rtlText: {textAlign:'right'},
  ltrText: {textAlign:'left'},
  screen: { flex: 1, padding: 22, backgroundColor: '#F8FAF8' },
  header: {
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 22,
  },
  logo: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: '#E8F1EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 26, lineHeight: 36, color: '#20322E', fontWeight: '700' },
  subtitle: {
    fontSize: 13,
    lineHeight: 22,
    color: '#64736D',
    marginTop: 10,
    marginBottom: 18,
  },
  search: {
    minHeight: 50,
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#DDE6DE',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  input: { flex: 1, paddingVertical: 14, color: '#20322E' },
  list: { paddingBottom: 20 },
  language: {
    alignItems: 'center',
    gap: 12,
    padding: 14,
    minHeight: 84,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E9E4',
    backgroundColor: '#FFFFFF',
    marginBottom: 10,
  },
  selected: { borderColor: '#24745A', backgroundColor: '#EBF3EE' },
  flex: { flex: 1 },
  nativeName: { fontSize: 20, color: '#20322E', paddingVertical: 4 },
  englishName: { fontSize: 12, color: '#64736D', marginTop: 4 },
  continue: {
    minHeight: 52,
    borderRadius: 8,
    backgroundColor: '#24745A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueText: { fontSize: 16, color: '#FFFFFF', fontWeight: '700' },
  error: { fontSize: 13, lineHeight: 20, color: '#A5412B', marginBottom: 12 },
});
