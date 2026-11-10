import { useEffect, useRef, useState } from 'react';
import uuid from 'react-native-uuid';
import {
  ChatRequestError,
  createConversation,
  listConversations,
  getConversation,
  deleteConversation,
  streamReply,
  type ChatSession,
  type Conversation,
  type ChatTurn,
} from './api';

export function useChat(
  session: ChatSession | undefined,
  active: boolean,
  language: string,
) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [busy, setBusy] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [streamText, setStreamText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      request.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (!session || !active) {
      return;
    }
    const controller = new AbortController();
    listConversations(session, controller.signal)
      .then(result => {
        if (!controller.signal.aborted) {
          setConversations(result);
        }
      })
      .catch(failure => {
        if (!controller.signal.aborted) {
          setError(
            failure instanceof ChatRequestError
              ? failure.code
              : 'chat_unavailable',
          );
        }
      });
    return () => controller.abort();
  }, [session, active]);

  const refreshHistory = async () => {
    if (!session) {
      return;
    }
    try {
      const result = await listConversations(session);
      if (mounted.current) {
        setConversations(result);
      }
    } catch (failure) {
      if (mounted.current) {
        setError(
          failure instanceof ChatRequestError
            ? failure.code
            : 'chat_unavailable',
        );
      }
    }
  };

  const newConversation = () => {
    if (request.current) {
      return;
    }
    setConversation(null);
    setTurns([]);
    setError(null);
    setStreamText('');
  };
  const openConversation = async (next: Conversation) => {
    if (request.current) {
      return false;
    }
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError(null);
    try {
      const history = await getConversation(next, session, controller.signal);
      if (mounted.current) {
        setConversation(next);
        setTurns(history);
        setStreamText('');
      }
      return true;
    } catch (failure) {
      if (mounted.current) {
        setError(
          failure instanceof ChatRequestError
            ? failure.code
            : 'chat_unavailable',
        );
      }
      return false;
    } finally {
      request.current = null;
      if (mounted.current) {
        setBusy(false);
      }
    }
  };
  const removeConversation = async (next: Conversation) => {
    if (request.current) {
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError(null);
    try {
      await deleteConversation(next, session, controller.signal);
      if (mounted.current) {
        setConversations(previous =>
          previous.filter(item => item.id !== next.id),
        );
        if (conversation?.id === next.id) {
          setConversation(null);
          setTurns([]);
        }
      }
    } catch (failure) {
      if (mounted.current) {
        setError(
          failure instanceof ChatRequestError
            ? failure.code
            : 'chat_unavailable',
        );
      }
    } finally {
      request.current = null;
      if (mounted.current) {
        setBusy(false);
      }
    }
  };
  const send = async (message: string, retry?: ChatTurn) => {
    if (request.current || !message.trim() || message.length > 6000) {
      return false;
    }
    const controller = new AbortController();
    request.current = controller;
    const requestId = retry?.requestId ?? String(uuid.v4());
    const turn: ChatTurn = {
      requestId,
      userText: message.trim(),
      assistantText: '',
      status: 'pending',
    };
    setBusy(true);
    setPendingId(requestId);
    setError(null);
    setStreamText('');
    setTurns(previous =>
      retry
        ? previous.map(item => (item.requestId === requestId ? turn : item))
        : [...previous, turn],
    );
    let updateTimer: ReturnType<typeof setTimeout> | undefined;
    let latest = '';
    try {
      const current =
        conversation ?? (await createConversation(session, controller.signal));
      if (!mounted.current || controller.signal.aborted) {
        throw new ChatRequestError('cancelled');
      }
      const named={...current,title:current.title==='New conversation'?turn.userText.slice(0,80):current.title};
      setConversation(named);
      setConversations(previous => [
        named,
        ...previous.filter(item => item.id !== current.id),
      ]);
      const text = await streamReply({
        conversation: current,
        session,
        message: turn.userText,
        requestId,
        language,
        signal: controller.signal,
        onText: value => {
          latest = value;
          if (!updateTimer) {
            updateTimer = setTimeout(() => {
              updateTimer = undefined;
              if (mounted.current) {
                setStreamText(latest);
              }
            }, 50);
          }
        },
      });
      if (mounted.current) {
        setTurns(previous =>
          previous.map(item =>
            item.requestId === requestId
              ? { ...turn, assistantText: text, status: 'completed' }
              : item,
          ),
        );
      }
      return true;
    } catch (failure) {
      if (mounted.current) {
        setTurns(previous =>
          previous.map(item =>
            item.requestId === requestId ? { ...turn, status: 'failed' } : item,
          ),
        );
        setError(
          failure instanceof ChatRequestError
            ? failure.code
            : 'chat_unavailable',
        );
      }
      return false;
    } finally {
      clearTimeout(updateTimer);
      request.current = null;
      if (mounted.current) {
        setBusy(false);
        setPendingId(null);
        setStreamText('');
      }
    }
  };
  return {
    conversations,
    conversation,
    turns,
    busy,
    pendingId,
    streamText,
    error,
    newConversation,
    openConversation,
    removeConversation,
    refreshHistory,
    send,
    stop: () => request.current?.abort(),
  };
}
