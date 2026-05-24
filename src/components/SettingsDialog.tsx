import { useState, useEffect, useRef } from 'react';
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
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  useEffect(() => {
    const overlay = overlayRef.current;
    const parent = overlay?.parentElement;
    if (!overlay || !parent) return;

    const siblings = Array.from(parent.children).filter((child) => child !== overlay);
    const previous = siblings.map((element) => {
      const htmlElement = element as HTMLElement & { inert?: boolean };
      return {
        element: htmlElement,
        ariaHidden: htmlElement.getAttribute('aria-hidden'),
        inert: htmlElement.inert ?? false,
      };
    });

    previous.forEach(({ element }) => {
      element.setAttribute('aria-hidden', 'true');
      element.inert = true;
    });

    return () => {
      previous.forEach(({ element, ariaHidden, inert }) => {
        if (ariaHidden === null) {
          element.removeAttribute('aria-hidden');
        } else {
          element.setAttribute('aria-hidden', ariaHidden);
        }
        element.inert = inert;
      });
    };
  }, []);

  const handleSave = () => {
    onSave(form);
    onSaveGitLab(gitLabForm);
    onClose();
  };

  return (
    <div ref={overlayRef} className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm animate-fade-in">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        className="w-full max-w-2xl max-h-[85vh] overflow-y-auto mx-4 p-6 glass-panel animate-slide-down"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 id="settings-title" className="text-base font-semibold text-slate-800">Settings</h2>
          <button
            type="button"
            onClick={onClose}
            className="ui-focus-ring flex h-10 w-10 items-center justify-center rounded-lg border border-transparent hover:bg-slate-100 transition-colors cursor-pointer text-slate-400"
            aria-label="Close settings"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <section>
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-slate-800">LLM</h3>
              <p className="mt-1 text-xs text-slate-500">
                Contrail サーバー側の ZAI GLM API キーを自動的に使います。
              </p>
            </div>

            <div className="rounded-xl border border-slate-200/60 bg-slate-50/70 px-4 py-3 text-[11px] leading-5 text-slate-500">
              APIキーはブラウザに保存せず、`ZAI_API_KEY` が設定された Contrail の `/api/glm` プロキシ経由で送信します。
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
                <label id="gitlab-enabled-label" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Enable GitLab
                </label>
                <span className="text-xs text-slate-400">SysViz 専用 GitLab 連携を有効化</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={gitLabForm.enabled}
                aria-labelledby="gitlab-enabled-label"
                onClick={() => setGitLabForm({ ...gitLabForm, enabled: !gitLabForm.enabled })}
                className={`
                  ui-focus-ring relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors
                  ${gitLabForm.enabled ? 'bg-blue-500' : 'bg-slate-300'}
                `}
              >
                <span
                  className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow transition-transform
                    ${gitLabForm.enabled ? 'translate-x-6' : 'translate-x-0'}
                  `}
                />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="gitlab-base-url" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  GitLab URL
                </label>
                <input
                  id="gitlab-base-url"
                  type="url"
                  value={gitLabForm.baseUrl}
                  onChange={(e) => setGitLabForm({ ...gitLabForm, baseUrl: e.target.value })}
                  placeholder="https://gitlab.example.com"
                  className="ui-focus-ring w-full px-4 py-2.5 rounded-xl border border-slate-200/60 bg-white/60 text-sm text-slate-800 placeholder:text-slate-400"
                />
              </div>

              <div>
                <label htmlFor="gitlab-access-token" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Access Token
                </label>
                <input
                  id="gitlab-access-token"
                  type="password"
                  value={gitLabForm.token}
                  onChange={(e) => setGitLabForm({ ...gitLabForm, token: e.target.value })}
                  placeholder="glpat-..."
                  className="ui-focus-ring w-full px-4 py-2.5 rounded-xl border border-slate-200/60 bg-white/60 text-sm text-slate-800 placeholder:text-slate-400 font-mono"
                />
              </div>

              <div>
                <label htmlFor="gitlab-sysviz-project-path" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  SysViz Project Path
                </label>
                <input
                  id="gitlab-sysviz-project-path"
                  type="text"
                  value={gitLabForm.sysvizProjectPath}
                  onChange={(e) => setGitLabForm({ ...gitLabForm, sysvizProjectPath: e.target.value })}
                  placeholder="sysviz/group-project"
                  className="ui-focus-ring w-full px-4 py-2.5 rounded-xl border border-slate-200/60 bg-white/60 text-sm text-slate-800 placeholder:text-slate-400"
                />
              </div>

              <div>
                <label htmlFor="gitlab-target-project-path" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Target Project Path
                </label>
                <input
                  id="gitlab-target-project-path"
                  type="text"
                  value={gitLabForm.targetProjectPath}
                  onChange={(e) => setGitLabForm({ ...gitLabForm, targetProjectPath: e.target.value })}
                  placeholder="group/project"
                  className="ui-focus-ring w-full px-4 py-2.5 rounded-xl border border-slate-200/60 bg-white/60 text-sm text-slate-800 placeholder:text-slate-400"
                />
              </div>

              <div>
                <label htmlFor="gitlab-target-ref" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Target Ref
                </label>
                <input
                  id="gitlab-target-ref"
                  type="text"
                  value={gitLabForm.targetRef}
                  onChange={(e) => setGitLabForm({ ...gitLabForm, targetRef: e.target.value })}
                  placeholder="main"
                  className="ui-focus-ring w-full px-4 py-2.5 rounded-xl border border-slate-200/60 bg-white/60 text-sm text-slate-800 placeholder:text-slate-400 font-mono"
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
            type="button"
            onClick={onClose}
            className="ui-focus-ring px-4 py-2 rounded-xl border border-transparent text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="ui-focus-ring px-5 py-2 rounded-xl border border-transparent text-sm font-medium bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 transition-colors cursor-pointer"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
