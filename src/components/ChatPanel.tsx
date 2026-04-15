import { useRef, useEffect, useState, useCallback } from 'react';
import { MessageCircle, Settings, Trash2, X } from 'lucide-react';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { SettingsDialog } from './SettingsDialog';
import type { PlaybackInfo } from '@/hooks/usePlayback';
import type { ViewConfig } from '@/types/visualization';
import type { LLMSettings } from '@/lib/llm/SettingsService';
import type { ChatMessage as ChatMessageType } from '@/hooks/useChat';

const MIN_WIDTH = 320;
const MAX_WIDTH = 800;
const DEFAULT_WIDTH = 420;
const WIDTH_KEY = 'sysviz-chat-width';

interface ChatPanelProps {
  playbackInfo: PlaybackInfo;
  viewConfig: ViewConfig | null;
  rawMmdText: string;
  onClose: () => void;
  messages: ChatMessageType[];
  isLoading: boolean;
  error: string | null;
  settings: LLMSettings;
  onSendMessage: (text: string) => void;
  onStopStreaming: () => void;
  onClearChat: () => void;
  onUpdateSettings: (settings: LLMSettings) => void;
}

// Suggestion pools by context
const IDLE_SUGGESTIONS = [
  'この可視化について教えて',
  '全体の流れを説明して',
  'ノードの形状の意味は？',
  'データはどう流れてる？',
  '重要なノードはどれ？',
  'システムの入力と出力は？',
  'このシステムの目的は？',
  'フェーズごとに教えて',
];

const PLAYING_SUGGESTIONS = [
  'このステップを詳しく説明して',
  '次に何が起きる？',
  'なぜこのノードが重要？',
  'ここでのデータの変化は？',
  '前のステップとどう違う？',
  'このノードの役割は？',
  'この後どうなるの？',
  'ここでエラーが起きたら？',
];

const POST_ANSWER_SUGGESTIONS = [
  'もっと詳しく説明して',
  '別の言い方で説明して',
  '具体例を教えて',
  '図のどの部分が関係してる？',
  '次は何を知るべき？',
  '他に気をつける点は？',
  'よくある失敗は何？',
  '実運用での注意点は？',
];

function pickRandom(arr: string[], count: number): string[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function getSuggestions(playbackInfo: PlaybackInfo, messages: ChatMessageType[]): string[] {
  const hasHistory = messages.length > 0;
  if (hasHistory) {
    return pickRandom(POST_ANSWER_SUGGESTIONS, 4);
  }
  if (playbackInfo.state === 'idle' && playbackInfo.currentStep < 0) {
    return pickRandom(IDLE_SUGGESTIONS, 4);
  }
  return pickRandom(PLAYING_SUGGESTIONS, 4);
}

export function ChatPanel({
  playbackInfo,
  viewConfig,
  rawMmdText,
  onClose,
  messages,
  isLoading,
  error,
  settings,
  onSendMessage,
  onStopStreaming,
  onClearChat,
  onUpdateSettings,
}: ChatPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [width, setWidth] = useState(() => {
    const saved = localStorage.getItem(WIDTH_KEY);
    return saved ? Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Number(saved) || DEFAULT_WIDTH)) : DEFAULT_WIDTH;
  });
  const dragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    startX.current = e.clientX;
    startWidth.current = width;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [width]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const delta = startX.current - e.clientX;
      const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth.current + delta));
      setWidth(next);
    };
    const onMouseUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      localStorage.setItem(WIDTH_KEY, String(width));
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [width]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const suggestions = getSuggestions(playbackInfo, messages);

  return (
    <>
      <div
        className="fixed top-0 right-0 z-30 h-full flex flex-col border-l border-white/50 bg-white/40 backdrop-blur-xl animate-slide-in-right"
        style={{ width }}
      >
        {/* Resize handle */}
        <div
          onMouseDown={handleResizeStart}
          className="absolute top-0 left-0 w-1.5 h-full cursor-col-resize hover:bg-blue-400/30 active:bg-blue-400/50 transition-colors z-10"
        />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200/30">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">SysViz AI</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {playbackInfo.activeNodeId
                ? `Analyzing: ${playbackInfo.activeNodeId}`
                : 'Ready to answer questions'}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={onClearChat}
              className="p-3 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Clear chat"
            >
              <Trash2 size={20} />
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="p-3 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Settings"
            >
              <Settings size={20} />
            </button>
            <button
              onClick={onClose}
              className="p-3 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 chat-scroll">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center mb-3">
                <MessageCircle size={30} className="text-blue-400" />
              </div>
              <p className="text-lg font-medium text-slate-600 mb-1">SysViz AI</p>
              <p className="text-sm text-slate-400 max-w-[280px]">
                可視化のステップについて質問してください。現在の再生状態をコンテキストに回答します。
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}

          {error && (
            <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200/40 text-sm text-red-600">
              {error}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-4 pb-4 pt-2 border-t border-slate-200/30">
          <ChatInput
            onSend={onSendMessage}
            onStop={onStopStreaming}
            isLoading={isLoading}
            suggestions={suggestions}
          />
        </div>
      </div>

      {/* Settings dialog */}
      {showSettings && (
        <SettingsDialog
          settings={settings}
          onSave={onUpdateSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </>
  );
}
