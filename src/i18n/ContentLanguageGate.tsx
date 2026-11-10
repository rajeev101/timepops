import React, { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Text, View } from './components';
import { useLanguage } from './LanguageProvider';

export default function ContentLanguageGate({
  children,
  contentLanguage = 'en-Latn-IN',
  contentId,
  onCancel,
}: {
  children: React.ReactNode;
  contentLanguage?: string;
  contentId: string;
  onCancel: () => void;
}) {
  const { language, t } = useLanguage();
  const [accepted, setAccepted] = useState<string | null>(null);
  const consentKey = `${language.locale}:${contentId}`;
  const sameLanguage = contentLanguage === language.locale;
  if (
    sameLanguage ||
    (accepted === consentKey && contentLanguage === 'en-Latn-IN')
  ) {
    return (
      <>
        {!sameLanguage && (
          <Text style={styles.notice}>{t('ui.contentEnglish')}</Text>
        )}
        {children}
      </>
    );
  }
  return (
    <View style={styles.gate}>
      <Text accessibilityRole="alert" style={styles.text}>
        {t('ui.unavailableLesson')}
      </Text>
      {contentLanguage === 'en-Latn-IN' && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="View content in English"
          onPress={() => setAccepted(consentKey)}
          style={styles.primary}
        >
          <Text style={styles.primaryText}>{t('ui.viewEnglish')}</Text>
        </Pressable>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Keep selected language"
        onPress={onCancel}
        style={styles.secondary}
      >
        <Text style={styles.text}>{t('ui.stayLanguage')}</Text>
      </Pressable>
    </View>
  );
}
const styles = StyleSheet.create({
  gate: { padding: 20, paddingVertical: 28, gap: 16, backgroundColor: '#FFFFFF' },
  text: { fontSize: 14, lineHeight: 24, color: '#20322E' },
  notice: { fontSize: 12, color: '#795B27', paddingVertical: 12 },
  primary: {
    minHeight: 48,
    backgroundColor: '#24745A',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  secondary: { minHeight: 44, justifyContent: 'center', alignItems: 'center' },
});
