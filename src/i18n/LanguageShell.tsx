import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Languages } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from './LanguageProvider';
import LanguageSelector from './LanguageSelector';

export default function LanguageShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const {
    ready,
    selecting,
    language,
    textStyle,
    rowStyle,
    t,
    error,
    openSelector,
    dismissSelector,
  } = useLanguage();
  const insets = useSafeAreaInsets();
  if (!ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator
          accessibilityLabel="Loading language"
          color="#24745A"
        />
      </View>
    );
  }
  return (
    <View style={styles.fill}>
      <Modal visible={selecting} animationType="slide" onRequestClose={dismissSelector}>
        <View style={[styles.fill,{paddingTop:insets.top,paddingBottom:insets.bottom}]}><LanguageSelector /></View>
      </Modal>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Change language"
        onPress={openSelector}
        style={[styles.settings, rowStyle, { paddingTop: insets.top + 6 }]}
      >
        <Languages size={17} color="#24745A" />
        <Text style={[styles.language, textStyle]}>
          {t('ui.language')}: {language.nativeName}
        </Text>
      </Pressable>
      {language.code !== 'en' && (
        <View style={styles.notice}>
          <Text style={[styles.noticeText, textStyle]}>
            {t('ui.englishContent')}
          </Text>
          <Text style={[styles.noticeText, textStyle]}>
            {t('ui.translationDraft')}
          </Text>
        </View>
      )}
      {error && (
        <Text accessibilityRole="alert" style={[styles.noticeText, textStyle]}>
          {error}
        </Text>
      )}
      <View style={styles.fill}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#F8FAF8' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  settings: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
  },
  language: { fontSize: 12, color: '#24745A' },
  notice: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: '#FFF7E4',
  },
  noticeText: { fontSize: 11, lineHeight: 19, color: '#795B27' },
});
