import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import ChatScreen from '../src/chat/ChatScreen';
import {
  createConversation,
  streamReply,
  listConversations,
  getConversation,
  ChatRequestError,
} from '../src/chat/api';
import { activateLanguage } from '../src/i18n/engine';

jest.mock('../src/chat/api', () => ({
  ...jest.requireActual('../src/chat/api'),
  createConversation: jest.fn(),
  streamReply: jest.fn(),
  listConversations: jest.fn(),
  getConversation: jest.fn(),
  deleteConversation: jest.fn(),
}));
let app: ReactTestRenderer.ReactTestRenderer;
const control = (label: string) =>
  app.root.findAll(
    node =>
      node.props.accessibilityLabel === label &&
      typeof node.props.onPress === 'function',
  )[0];
const type = async (text: string) => {
  await ReactTestRenderer.act(async () =>
    app.root
      .findAll(
        node =>
          node.props.accessibilityLabel === 'Ask BharatShikshak AI...' &&
          node.props.onChangeText,
      )[0]
      .props.onChangeText(text),
  );
};
const press = async (label: string) => {
  await ReactTestRenderer.act(async () => control(label).props.onPress());
};
beforeEach(async () => {
  jest.clearAllMocks();
  await activateLanguage('en');
  jest.mocked(createConversation).mockResolvedValue({
    id: 'thread',
    title: 'New conversation',
    guestToken: 'guest',
  });
  jest.mocked(listConversations).mockResolvedValue([]);
  jest.mocked(streamReply).mockImplementation(async options => {
    options.onText('A streamed response');
    return '## Answer\n\n- A useful explanation\n\n```python\nprint("hello")\n```';
  });
  await ReactTestRenderer.act(async () => {
    app = ReactTestRenderer.create(<ChatScreen />);
  });
});
afterEach(async () => {
  await ReactTestRenderer.act(async () => app.unmount());
  await activateLanguage('en');
});
test('resizes the Android chat to keep its composer above the keyboard', async () => {
  const platform = jest.replaceProperty(Platform, 'OS', 'android');
  const screen = app.root.findByProps({ testID: 'chat-screen' });
  const nativeScreen = screen.instance as React.ComponentRef<typeof View>;
  const measure = jest
    .spyOn(nativeScreen, 'measureInWindow')
    .mockImplementation(callback => callback(0, 120, 360, 600));
  try {
    await ReactTestRenderer.act(async () => app.update(<ChatScreen />));
    await ReactTestRenderer.act(async () => screen.props.onLayout());
    expect(app.root.findByType(KeyboardAvoidingView).props.behavior).toBe(
      'height',
    );
    expect(
      app.root.findByType(KeyboardAvoidingView).props.keyboardVerticalOffset,
    ).toBe(120);
  } finally {
    measure.mockRestore();
    platform.restore();
  }
});
test('presents the official assistant and renders formatted Gemini output', async () => {
  expect(JSON.stringify(app.toJSON())).toContain('powered by Google Gemini');
  await type('Explain this');
  await press('Send message');
  expect(streamReply).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(app.toJSON())).toContain('A useful explanation');
  expect(JSON.stringify(app.toJSON())).toContain('print(\\"hello\\")');
  const first = jest.mocked(streamReply).mock.calls[0][0];
  await type('What about another example?');
  await press('Send message');
  expect(jest.mocked(streamReply).mock.calls[1][0].conversation.id).toBe(
    first.conversation.id,
  );
  expect(createConversation).toHaveBeenCalledTimes(1);
  await press('Chat history');
  expect(control('Explain this')).toBeDefined();
});
test('shows a friendly rate-limit error and retries the same logical request', async () => {
  jest
    .mocked(streamReply)
    .mockRejectedValueOnce(new ChatRequestError('rate_limited'));
  await type('Hello');
  await press('Send message');
  expect(JSON.stringify(app.toJSON())).toContain('wait a minute');
  const requestId = jest.mocked(streamReply).mock.calls[0][0].requestId;
  await press('Retry response');
  expect(jest.mocked(streamReply).mock.calls[1][0].requestId).toBe(requestId);
});
test('blocks rapid duplicate submits and supports cancellation', async () => {
  jest
    .mocked(streamReply)
    .mockImplementation(
      options =>
        new Promise((_resolve, reject) =>
          options.signal.addEventListener('abort', () =>
            reject(new ChatRequestError('cancelled')),
          ),
        ),
    );
  await type('Hello');
  const submit = control('Send message').props.onPress;
  await ReactTestRenderer.act(async () => {
    submit();
    submit();
  });
  expect(streamReply).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(app.toJSON())).toContain('is thinking');
  await press('Stop response');
  expect(JSON.stringify(app.toJSON())).toContain('Response stopped.');
  await press('New conversation');
  expect(JSON.stringify(app.toJSON())).not.toContain('Response stopped.');
});

test('authenticated history reopens a saved conversation with its existing context', async () => {
  const session = {
    userId: 'verified-user',
    accessToken: 'opaque-test-session',
  };
  const conversation = { id: 'saved-thread', title: 'Saved math chat' };
  jest.mocked(listConversations).mockResolvedValue([conversation]);
  jest.mocked(getConversation).mockResolvedValue([
    {
      requestId: 'old',
      userText: 'What is 2 + 2?',
      assistantText: '4',
      status: 'completed',
    },
  ]);
  await ReactTestRenderer.act(async () => {
    app.unmount();
    app = ReactTestRenderer.create(<ChatScreen session={session} />);
  });
  await press('Chat history');
  await press('Saved math chat');
  expect(getConversation).toHaveBeenCalledWith(
    conversation,
    session,
    expect.any(AbortSignal),
  );
  expect(JSON.stringify(app.toJSON())).toContain('What is 2 + 2?');
  await type('Why?');
  await press('Send message');
  expect(jest.mocked(streamReply).mock.calls[0][0].conversation.id).toBe(
    'saved-thread',
  );
  expect(jest.mocked(streamReply).mock.calls[0][0].session).toEqual(session);
});

test('Hindi input is forwarded unchanged and transport timeouts remain friendly', async () => {
  jest
    .mocked(streamReply)
    .mockRejectedValue(new ChatRequestError('chat_timeout'));
  await type('गुरुत्वाकर्षण क्या है?');
  await press('Send message');
  expect(jest.mocked(streamReply).mock.calls[0][0].message).toBe(
    'गुरुत्वाकर्षण क्या है?',
  );
  expect(JSON.stringify(app.toJSON())).toContain('response took too long');
});
