import { useState, useCallback, useRef } from 'react';
import { streamChat, type LLMConfig } from '@/lib/llm/LLMService';
import { loadSettings, saveSettings, getActiveConfig, type LLMSettings } from '@/lib/llm/SettingsService';
import { buildSystemPrompt } from '@/lib/llm/ContextBuilder';
import type { ViewConfig } from '@/types/visualization';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<LLMSettings>(loadSettings);
  const abortRef = useRef<AbortController | null>(null);
  const msgIdRef = useRef(0);
  const messagesRef = useRef<ChatMessage[]>([]);

  const updateMessages = useCallback((updater: (prev: ChatMessage[]) => ChatMessage[]) => {
    setMessages((prev) => {
      const next = updater(prev);
      messagesRef.current = next;
      return next;
    });
  }, []);

  const updateSettings = useCallback((newSettings: LLMSettings) => {
    setSettings(newSettings);
    saveSettings(newSettings);
  }, []);

  const clearChat = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    messagesRef.current = [];
    setMessages([]);
    setError(null);
    setIsLoading(false);
  }, []);

  const sendMessage = useCallback(
    async (
      text: string,
      viewName: string,
      viewConfig: ViewConfig | null = null,
      rawMmdText: string = '',
    ) => {
      const config = getActiveConfig(settings);
      if (!config) {
        setError('APIキーが設定されていません。設定画面でAPIキーを入力してください。');
        return;
      }

      abortRef.current?.abort();
      const previousMessages = messagesRef.current;

      const userMsg: ChatMessage = {
        id: `msg-${++msgIdRef.current}`,
        role: 'user',
        content: text,
        timestamp: Date.now(),
      };

      const assistantMsg: ChatMessage = {
        id: `msg-${++msgIdRef.current}`,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
      };

      updateMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsLoading(true);
      setError(null);

      const systemPrompt = buildSystemPrompt(viewName, viewConfig, rawMmdText);
      const history = [...previousMessages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const abortController = new AbortController();
      abortRef.current = abortController;

      try {
        await streamChat(
          config as LLMConfig,
          history,
          systemPrompt,
          {
            onToken: (token) => {
              updateMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsg.id
                    ? { ...m, content: m.content + token }
                    : m
                )
              );
            },
            onDone: () => {
              setIsLoading(false);
              abortRef.current = null;
            },
            onError: (err) => {
              setError(err);
              setIsLoading(false);
              abortRef.current = null;
            },
          },
          abortController.signal
        );
      } catch (err) {
        if (abortController.signal.aborted) {
          setIsLoading(false);
          return;
        }
        const message = err instanceof Error ? err.message : 'チャットの送信に失敗しました。';
        setError(message);
        setIsLoading(false);
        abortRef.current = null;
      }
    },
    [settings, updateMessages]
  );

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsLoading(false);
  }, []);

  return {
    messages,
    isLoading,
    error,
    settings,
    updateSettings,
    sendMessage,
    stopStreaming,
    clearChat,
  };
}
