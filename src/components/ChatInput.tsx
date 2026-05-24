import { useState, useRef, useEffect } from 'react';
import { Send, Square } from 'lucide-react';

interface ChatInputProps {
  onSend: (text: string) => void;
  onStop: () => void;
  isLoading: boolean;
  suggestions: string[];
}

export function ChatInput({ onSend, onStop, isLoading, suggestions }: ChatInputProps) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;
    onSend(trimmed);
    setText('');
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Suggestion chips */}
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-1">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                onSend(s);
              }}
              disabled={isLoading}
              className="ui-focus-ring text-sm px-4 py-2.5 rounded-full border border-slate-200/60 bg-white/50 text-slate-600 hover:bg-white/80 hover:border-slate-300/60 transition-colors disabled:opacity-40 disabled:cursor-default cursor-pointer"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder="質問を入力..."
          aria-label="Chat message"
          disabled={isLoading}
          rows={2}
          className="ui-focus-ring flex-1 resize-none px-4 py-3 rounded-2xl border border-slate-200/60 bg-white/60 text-base text-slate-800 placeholder:text-slate-400 disabled:opacity-60 transition-all"
        />
        {isLoading ? (
          <button
            type="button"
            onClick={onStop}
            className="ui-focus-ring flex items-center justify-center w-11 h-11 rounded-full border border-transparent bg-red-50 text-red-500 hover:bg-red-100 transition-colors cursor-pointer"
            aria-label="Stop"
          >
            <Square size={18} />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!text.trim()}
            className="ui-focus-ring flex items-center justify-center w-11 h-11 rounded-full border border-transparent bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 transition-colors disabled:opacity-30 disabled:cursor-default cursor-pointer"
            aria-label="Send"
          >
            <Send size={18} />
          </button>
        )}
      </div>
    </div>
  );
}
