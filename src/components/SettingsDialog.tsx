import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { LLMSettings } from '@/lib/llm/SettingsService';
import type { GitLabSettings } from '@/lib/gitlab/GitLabSettings';

interface SettingsDialogProps {
  settings: LLMSettings;
  gitLabSettings: GitLabSettings;
  onSave: (settings: LLMSettings) => void;
  onSaveGitLab: (settings: GitLabSettings) => void;
  onClose: () => void;
}

export function SettingsDialog({
  settings,
  gitLabSettings,
  onSave,
  onSaveGitLab,
  onClose,
}: SettingsDialogProps) {
  const [form, setForm] = useState<LLMSettings>(structuredClone(settings));
  const [gitLabForm, setGitLabForm] = useState<GitLabSettings>(structuredClone(gitLabSettings));

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleSave = () => {
    onSave(form);
    onSaveGitLab(gitLabForm);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto mx-4 p-6 glass-panel animate-slide-down">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-slate-800">Settings</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer text-slate-400"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <section>
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-slate-800">LLM</h3>
              <p className="mt-1 text-xs text-slate-500">
                チャットとキャプション補完に使う設定です。
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Provider
              </label>
              <div className="flex gap-2">
                {(['gemini', 'glm'] as const).map((p) => (
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
                    {p === 'gemini' ? 'Gemini' : 'GLM'}
                  </button>
                ))}
              </div>
            </div>

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
                placeholder={form.provider === 'gemini' ? 'AIza...' : 'sk-...'}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200/60 bg-white/60 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-blue-400/50 font-mono"
              />
            </div>

            <div className="mb-6 flex items-center justify-between">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  AI解説
                </label>
                <span className="text-xs text-slate-400">読み込み時にLLMでキャプションを生成</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={form.captionEnrichment}
                onClick={() => setForm({ ...form, captionEnrichment: !form.captionEnrichment })}
                className={`
                  relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors
                  ${form.captionEnrichment ? 'bg-blue-500' : 'bg-slate-300'}
                `}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform
                    ${form.captionEnrichment ? 'translate-x-5' : 'translate-x-0'}
                  `}
                />
              </button>
            </div>
          </section>

          <section>
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-slate-800">GitLab</h3>
              <p className="mt-1 text-xs text-slate-500">
                SysViz 専用プロジェクトの artifacts から、対象 repo / ref ごとの manifest と `.mmd` を読み込みます。
              </p>
            </div>

            <div className="mb-4 flex items-center justify-between">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Enable GitLab
                </label>
                <span className="text-xs text-slate-400">SysViz 専用 GitLab 連携を有効化</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={gitLabForm.enabled}
                onClick={() => setGitLabForm({ ...gitLabForm, enabled: !gitLabForm.enabled })}
                className={`
                  relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors
                  ${gitLabForm.enabled ? 'bg-blue-500' : 'bg-slate-300'}
                `}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform
                    ${gitLabForm.enabled ? 'translate-x-5' : 'translate-x-0'}
                  `}
                />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  GitLab URL
                </label>
                <input
                  type="url"
                  value={gitLabForm.baseUrl}
                  onChange={(e) => setGitLabForm({ ...gitLabForm, baseUrl: e.target.value })}
                  placeholder="https://gitlab.example.com"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200/60 bg-white/60 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-blue-400/50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Access Token
                </label>
                <input
                  type="password"
                  value={gitLabForm.token}
                  onChange={(e) => setGitLabForm({ ...gitLabForm, token: e.target.value })}
                  placeholder="glpat-..."
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200/60 bg-white/60 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-blue-400/50 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  SysViz Project Path
                </label>
                <input
                  type="text"
                  value={gitLabForm.sysvizProjectPath}
                  onChange={(e) => setGitLabForm({ ...gitLabForm, sysvizProjectPath: e.target.value })}
                  placeholder="sysviz/group-project"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200/60 bg-white/60 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-blue-400/50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Target Project Path
                </label>
                <input
                  type="text"
                  value={gitLabForm.targetProjectPath}
                  onChange={(e) => setGitLabForm({ ...gitLabForm, targetProjectPath: e.target.value })}
                  placeholder="group/project"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200/60 bg-white/60 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-blue-400/50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Target Ref
                </label>
                <input
                  type="text"
                  value={gitLabForm.targetRef}
                  onChange={(e) => setGitLabForm({ ...gitLabForm, targetRef: e.target.value })}
                  placeholder="main"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200/60 bg-white/60 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-blue-400/50 font-mono"
                />
              </div>

              <div className="rounded-xl border border-slate-200/60 bg-slate-50/70 px-4 py-3 text-[11px] leading-5 text-slate-500">
                Artifact path example: <span className="font-mono">outputs/group__project/main/manifest.json</span>
              </div>
            </div>
          </section>
        </div>

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
