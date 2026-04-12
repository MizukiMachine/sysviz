import { useRef, useEffect, useState } from 'react';
import { MessageCircle, Settings, Trash2, X } from 'lucide-react';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { SettingsDialog } from './SettingsDialog';
import type { PlaybackInfo } from '@/hooks/usePlayback';
import type { LLMSettings } from '@/lib/llm/SettingsService';
import type { ChatMessage as ChatMessageType } from '@/hooks/useChat';

interface ChatPanelProps {
  playbackInfo: PlaybackInfo;
  selectedView: string;
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

function getSuggestions(playbackInfo: PlaybackInfo): string[] {
  if (playbackInfo.state === 'idle' && playbackInfo.currentStep < 0) {
    return [
      'この可視化について教えて',
      '全体の流れを説明して',
      'ノードの形状の意味は？',
    ];
  }
  return [
    'このステップを詳しく説明して',
    '次に何が起きる？',
    'なぜこのノードが重要？',
  ];
}

export function ChatPanel({
  playbackInfo,
  selectedView,
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const suggestions = getSuggestions(playbackInfo);

  return (
    <>
      <div className="fixed top-0 right-0 z-30 w-[420px] h-full flex flex-col border-l border-white/50 bg-white/40 backdrop-blur-xl animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200/30">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">SysViz AI</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {playbackInfo.activeNodeId
                ? `Analyzing: ${playbackInfo.activeNodeId}`
                : 'Ready to answer questions'}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={onClearChat}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Clear chat"
            >
              <Trash2 size={16} />
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Settings"
            >
              <Settings size={16} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 chat-scroll">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center mb-3">
                <MessageCircle size={22} className="text-blue-400" />
              </div>
              <p className="text-sm font-medium text-slate-600 mb-1">SysViz AI</p>
              <p className="text-xs text-slate-400 max-w-[240px]">
                可視化のステップについて質問してください。現在の再生状態をコンテキストに回答します。
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}

          {error && (
            <div className="px-4 py-2.5 rounded-xl bg-red-50 border border-red-200/40 text-xs text-red-600">
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

