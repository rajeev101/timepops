import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  History,
  Plus,
  RotateCcw,
  Send,
  Square,
  Trash2,
  X,
} from 'lucide-react-native';
import Markdown, {
  MarkdownIt,
  type RenderRules,
} from 'react-native-markdown-display';
import { useTranslation } from 'react-i18next';
import { i18n } from '../i18n/engine';
import { useLanguage } from '../i18n/LanguageProvider';
import english from '../../locales/chat.en.json';
import hindi from '../../locales/chat.hi.json';
import { useChat } from './useChat';
import type { ChatSession } from './api';

i18n.addResourceBundle('en', 'chat', english, true);
i18n.addResourceBundle('hi', 'chat', hindi, true);
const markdown = new MarkdownIt({
  html: false,
  linkify: false,
  typographer: false,
  breaks: true,
}).disable('image');
const rules: RenderRules = {
  image: () => null,
  fence: node => (
    <ScrollView key={node.key} horizontal style={styles.codeScroll}>
      <Text selectable style={styles.code}>
        {node.content}
      </Text>
    </ScrollView>
  ),
  code_block: node => (
    <ScrollView key={node.key} horizontal style={styles.codeScroll}>
      <Text selectable style={styles.code}>
        {node.content}
      </Text>
    </ScrollView>
  ),
};

export default function ChatScreen({
  session,
  active = true,
}: {
  session?: ChatSession;
  active?: boolean;
}) {
  const { language, textStyle, rtl } = useLanguage();
  const { t } = useTranslation('chat', { i18n });
  const chat = useChat(session, active, language.locale);
  const [input, setInput] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const screen = useRef<React.ComponentRef<typeof View>>(null);
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const nearBottom = useRef(true);
  const row = rtl ? styles.rtlRow : styles.row;
  const last = chat.turns.at(-1);
  const errorText = chat.error
    ? t(`errors.${chat.error}`, { defaultValue: t('errors.chat_unavailable') })
    : '';
  const send = () => {
    if (chat.busy || !input.trim()) {
      return;
    }
    const text = input;
    setInput('');
    nearBottom.current = true;
    chat.send(text);
  };
  const openLink = (url: string) => {
    if (/^https:\/\//i.test(url)) {
      Alert.alert(t('openLink'), url, [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('open'),
          onPress: () => {
            Linking.openURL(url).catch(() => {});
          },
        },
      ]);
    }
    return false;
  };
  const markdownStyles = {
    body: { ...styles.answer, ...textStyle, writingDirection: 'auto' as const },
    heading1: styles.heading1,
    heading2: styles.heading2,
    heading3: styles.heading3,
    code_inline: styles.inlineCode,
    link: styles.link,
    paragraph: styles.paragraph,
  };
  return (
    <View
      ref={screen}
      testID="chat-screen"
      style={styles.screen}
      onLayout={() => {
        screen.current?.measureInWindow((_left, top) => setKeyboardOffset(top));
      }}
    >
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={keyboardOffset}
      >
        <View style={[styles.header, row]}>
          <Image
            source={require('../../assets/brand/logo.png')}
            accessibilityLabel="bharatshiksak logo"
            style={styles.logo}
            resizeMode="contain"
          />
          <View style={styles.headerText}>
            <Text
              accessibilityRole="header"
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
              style={[styles.title, textStyle]}
            >
              {t('title')}
            </Text>
            <Text style={[styles.credit, textStyle]}>{t('poweredBy')}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('history')}
            onPress={() => {
              setHistoryOpen(true);
              chat.refreshHistory();
            }}
            style={styles.icon}
          >
            <History size={21} color="#24745A" />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('newChat')}
            disabled={chat.busy}
            accessibilityState={{ disabled: chat.busy }}
            onPress={() => {
              chat.newConversation();
              setInput('');
            }}
            style={[styles.icon, chat.busy && styles.disabled]}
          >
            <Plus size={23} color="#24745A" />
          </Pressable>
        </View>
        <ScrollView
          ref={scroll}
          style={styles.feed}
          contentContainerStyle={styles.messages}
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={100}
          onScroll={event => {
            const { layoutMeasurement, contentOffset, contentSize } =
              event.nativeEvent;
            nearBottom.current =
              layoutMeasurement.height + contentOffset.y >=
              contentSize.height - 100;
          }}
          onContentSizeChange={() => {
            if (nearBottom.current) {
              scroll.current?.scrollToEnd({ animated: false });
            }
          }}
        >
          {!chat.turns.length && (
            <View style={styles.intro}>
              <Text style={[styles.introText, textStyle]}>{t('intro')}</Text>
            </View>
          )}
          {chat.turns.map(turn => (
            <View key={turn.requestId} style={styles.turn}>
              <View style={styles.userBubble}>
                <Text style={[styles.userLabel, textStyle]}>{t('you')}</Text>
                <Text selectable style={[styles.userText, textStyle]}>
                  {turn.userText}
                </Text>
              </View>
              {turn.status === 'completed' && (
                <View style={styles.assistant}>
                  <Text style={[styles.assistantLabel, textStyle]}>
                    {t('title')}
                  </Text>
                  <Markdown
                    markdownit={markdown}
                    rules={rules}
                    style={markdownStyles}
                    onLinkPress={openLink}
                  >
                    {turn.assistantText}
                  </Markdown>
                </View>
              )}
              {chat.pendingId === turn.requestId && (
                <View style={styles.assistant}>
                  <Text style={[styles.assistantLabel, textStyle]}>
                    {t('title')}
                  </Text>
                  {chat.streamText ? (
                    <Text selectable style={[styles.answer, textStyle]}>
                      {chat.streamText}
                    </Text>
                  ) : (
                    <View style={[styles.typing, row]}>
                      <ActivityIndicator size="small" color="#24745A" />
                      <Text
                        accessibilityLiveRegion="polite"
                        style={[styles.muted, textStyle]}
                      >
                        {t('typing')}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          ))}
          {chat.busy && !chat.pendingId && (
            <ActivityIndicator
              accessibilityLabel={t('loading')}
              color="#24745A"
            />
          )}
          {!!chat.error && (
            <View style={styles.error}>
              <Text
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
                style={[styles.errorText, textStyle]}
              >
                {errorText}
              </Text>
              {last?.status === 'failed' && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('retry')}
                  disabled={chat.busy}
                  onPress={() => {
                    nearBottom.current = true;
                    chat.send(last.userText, last);
                  }}
                  style={[styles.retry, row]}
                >
                  <RotateCcw size={17} color="#24745A" />
                  <Text style={[styles.retryText, textStyle]}>
                    {t('retry')}
                  </Text>
                </Pressable>
              )}
            </View>
          )}
        </ScrollView>
        <View style={styles.composerBand}>
          <View style={[styles.composer, row]}>
            <TextInput
              accessibilityLabel={t('placeholder')}
              placeholder={t('placeholder')}
              placeholderTextColor="#64736D"
              multiline
              maxLength={6000}
              value={input}
              onChangeText={setInput}
              editable={!chat.busy}
              style={[styles.input, textStyle]}
            />
            {chat.busy ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('stop')}
                onPress={chat.stop}
                style={styles.send}
              >
                <Square size={19} color="#FFFFFF" fill="#FFFFFF" />
              </Pressable>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('send')}
                accessibilityState={{ disabled: !input.trim() }}
                disabled={!input.trim()}
                onPress={send}
                style={[styles.send, !input.trim() && styles.disabled]}
              >
                <Send size={20} color="#FFFFFF" />
              </Pressable>
            )}
          </View>
          <Text style={[styles.disclaimer, textStyle]}>{t('disclaimer')}</Text>
        </View>
        <Modal
          visible={historyOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setHistoryOpen(false)}
        >
          <View style={styles.modalBackdrop}>
            <View accessibilityViewIsModal style={styles.historyPanel}>
              <View style={[styles.historyHeader, row]}>
                <View style={styles.headerText}>
                  <Text
                    accessibilityRole="header"
                    style={[styles.historyTitle, textStyle]}
                  >
                    {t('history')}
                  </Text>
                  <Text style={[styles.muted, textStyle]}>
                    {t(session ? 'accountHistory' : 'guestHistory')}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('close')}
                  onPress={() => setHistoryOpen(false)}
                  style={styles.icon}
                >
                  <X size={23} color="#20322E" />
                </Pressable>
              </View>
              <ScrollView contentContainerStyle={styles.historyList}>
                {!chat.conversations.length && (
                  <Text style={[styles.muted, textStyle]}>
                    {t('emptyHistory')}
                  </Text>
                )}
                {chat.conversations.map(item => (
                  <View key={item.id} style={[styles.historyItem, row]}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={item.title}
                      disabled={chat.busy}
                      style={styles.historyEntry}
                      onPress={async () => {
                        if (await chat.openConversation(item)) {
                          setHistoryOpen(false);
                          setInput('');
                          nearBottom.current = true;
                        }
                      }}
                    >
                      <Text
                        numberOfLines={2}
                        style={[styles.historyText, textStyle]}
                      >
                        {item.title}
                      </Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${t('delete')}: ${item.title}`}
                      disabled={chat.busy}
                      onPress={() =>
                        Alert.alert(t('delete'), t('deleteConfirm'), [
                          { text: t('cancel'), style: 'cancel' },
                          {
                            text: t('delete'),
                            style: 'destructive',
                            onPress: () => {
                              chat.removeConversation(item);
                            },
                          },
                        ])
                      }
                      style={styles.icon}
                    >
                      <Trash2 size={18} color="#835348" />
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
              {!session && (
                <Text style={[styles.guestNotice, textStyle]}>
                  {t('guestNotice')}
                </Text>
              )}
              {!!chat.error && (
                <Text
                  accessibilityRole="alert"
                  style={[styles.errorText, styles.historyError, textStyle]}
                >
                  {errorText}
                </Text>
              )}
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAF8' },
  row: { flexDirection: 'row' },
  rtlRow: { flexDirection: 'row-reverse' },
  header: {
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E9E4',
    backgroundColor: '#FFFFFF',
  },
  logo: { width: 44, height: 44, flexShrink: 0 },
  headerText: { flex: 1, minWidth: 0 },
  title: { fontSize: 18, fontWeight: '700', color: '#20322E' },
  credit: { fontSize: 10, lineHeight: 16, color: '#64736D', marginTop: 3 },
  icon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  feed: { flex: 1 },
  messages: {
    padding: 18,
    paddingBottom: 24,
    width: '100%',
    maxWidth: 820,
    alignSelf: 'center',
  },
  intro: { paddingVertical: 28 },
  introText: { fontSize: 16, lineHeight: 26, color: '#20322E' },
  turn: { marginBottom: 22 },
  userBubble: {
    alignSelf: 'flex-end',
    maxWidth: '94%',
    padding: 14,
    backgroundColor: '#E5F0E9',
    borderRadius: 8,
  },
  userLabel: {
    fontSize: 11,
    color: '#47725C',
    fontWeight: '700',
    marginBottom: 5,
  },
  userText: { fontSize: 15, lineHeight: 24, color: '#20322E' },
  assistant: { paddingTop: 18 },
  assistantLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#24745A',
    marginBottom: 6,
  },
  answer: { fontSize: 15, lineHeight: 26, color: '#20322E' },
  heading1: {
    fontSize: 22,
    lineHeight: 30,
    fontWeight: '700',
    marginVertical: 10,
  },
  heading2: {
    fontSize: 19,
    lineHeight: 28,
    fontWeight: '700',
    marginVertical: 8,
  },
  heading3: {
    fontSize: 17,
    lineHeight: 26,
    fontWeight: '700',
    marginVertical: 8,
  },
  paragraph: { marginTop: 4, marginBottom: 10 },
  inlineCode: {
    backgroundColor: '#E9EEEA',
    color: '#20322E',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  codeScroll: {
    backgroundColor: '#EDF1EE',
    borderRadius: 6,
    marginVertical: 10,
  },
  code: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
    lineHeight: 21,
    padding: 14,
    color: '#20322E',
    writingDirection: 'ltr',
    textAlign: 'left',
  },
  link: { color: '#24745A' },
  typing: { alignItems: 'center', gap: 10, minHeight: 38 },
  muted: { fontSize: 12, lineHeight: 20, color: '#64736D', flexShrink: 1 },
  error: { paddingVertical: 12, gap: 8 },
  errorText: { fontSize: 13, lineHeight: 22, color: '#8B493A' },
  retry: {
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    alignSelf: 'flex-start',
  },
  retryText: { fontSize: 13, fontWeight: '700', color: '#24745A' },
  composerBand: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
    borderTopWidth: 1,
    borderTopColor: '#E2E9E4',
    backgroundColor: '#FFFFFF',
  },
  composer: {
    alignItems: 'flex-end',
    gap: 10,
    width: '100%',
    maxWidth: 820,
    alignSelf: 'center',
  },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 132,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#D8E3DC',
    borderRadius: 8,
    color: '#20322E',
    fontSize: 15,
    lineHeight: 22,
    backgroundColor: '#F8FAF8',
    textAlignVertical: 'top',
  },
  send: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#24745A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.4 },
  disclaimer: {
    fontSize: 10,
    lineHeight: 16,
    color: '#64736D',
    paddingVertical: 6,
    textAlign: 'center',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(16,30,22,0.42)',
  },
  historyPanel: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    width: '100%',
    maxWidth: 560,
    maxHeight: '85%',
  },
  historyHeader: {
    alignItems: 'center',
    padding: 18,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E9E4',
  },
  historyTitle: {
    fontSize: 19,
    color: '#20322E',
    fontWeight: '700',
    marginBottom: 4,
  },
  historyList: { paddingHorizontal: 18, paddingVertical: 12 },
  historyItem: {
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E9E4',
  },
  historyEntry: { flex: 1, paddingVertical: 16, minHeight: 52 },
  historyText: { fontSize: 14, lineHeight: 22, color: '#20322E' },
  guestNotice: { fontSize: 11, lineHeight: 18, color: '#64736D', padding: 18 },
  historyError: { padding: 18 },
});
