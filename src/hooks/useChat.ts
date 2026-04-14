import { useState, useCallback, useRef } from 'react';
import { streamChat, type LLMConfig } from '@/lib/llm/LLMService';
import { loadSettings, saveSettings, getActiveConfig, type LLMSettings } from '@/lib/llm/SettingsService';
import { buildSystemPrompt } from '@/lib/llm/ContextBuilder';
import type { PlaybackInfo } from './usePlayback';

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

  const updateSettings = useCallback((newSettings: LLMSettings) => {
    setSettings(newSettings);
    saveSettings(newSettings);
  }, []);

  const clearChat = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    setMessages([]);
    setError(null);
    setIsLoading(false);
  }, []);

  const sendMessage = useCallback(
    async (text: string, playbackInfo: PlaybackInfo, viewName: string) => {
      const config = getActiveConfig(settings);
      if (!config) {
        setError('APIキーが設定されていません。設定画面でAPIキーを入力してください。');
        return;
      }

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

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsLoading(true);
      setError(null);

      const systemPrompt = buildSystemPrompt(viewName, playbackInfo);
      const history = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const abortController = new AbortController();
      abortRef.current = abortController;

      await streamChat(
        config as LLMConfig,
        history,
        systemPrompt,
        {
          onToken: (token) => {
            setMessages((prev) =>
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
    },
    [messages, settings]
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
