import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { LLMSettings } from '@/lib/llm/SettingsService';

interface SettingsDialogProps {
  settings: LLMSettings;
  onSave: (settings: LLMSettings) => void;
  onClose: () => void;
}

export function SettingsDialog({ settings, onSave, onClose }: SettingsDialogProps) {
  const [form, setForm] = useState<LLMSettings>(structuredClone(settings));

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleSave = () => {
    onSave(form);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md mx-4 p-6 glass-panel animate-slide-down">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-slate-800">LLM Settings</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer text-slate-400"
          >
            <X size={18} />
          </button>
        </div>

        {/* Provider */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
            Provider
          </label>
          <div className="flex gap-2">
            {(['anthropic', 'openai'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setForm({ ...form, provider: p })}
                className={`
                  flex-1 py-2 px-3 rounded-xl text-sm font-medium border transition-colors cursor-pointer
                  ${
                    form.provider === p
                      ? 'border-blue-300/60 bg-blue-50 text-blue-700'
                      : 'border-slate-200/60 bg-white/50 text-slate-600 hover:bg-white/80'
                  }
                `}
              >
                {p === 'anthropic' ? 'Anthropic Claude' : 'OpenAI'}
              </button>
            ))}
          </div>
        </div>

        {/* API Key */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
            API Key
          </label>
          <input
            type="password"
            value={form[form.provider].apiKey}
            onChange={(e) =>
              setForm({
                ...form,
                [form.provider]: {
                  ...form[form.provider],
                  apiKey: e.target.value,
                },
              })
            }
            placeholder="sk-..."
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200/60 bg-white/60 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-blue-400/50 font-mono"
          />
        </div>

        {/* Model */}
        <div className="mb-6">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
            Model
          </label>
          <input
            type="text"
            value={form[form.provider].model}
            onChange={(e) =>
              setForm({
                ...form,
                [form.provider]: {
                  ...form[form.provider],
                  model: e.target.value,
                },
              })
            }
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200/60 bg-white/60 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-blue-400/50 font-mono"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 rounded-xl text-sm font-medium bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 transition-colors cursor-pointer"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
