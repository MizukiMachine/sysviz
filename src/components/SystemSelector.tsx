import { ChevronDown, RefreshCw } from 'lucide-react';
import type { ViewEntry, VisualizationKey } from '@/lib/views/viewRegistry';

interface SystemSelectorProps {
  value: VisualizationKey;
  onChange: (value: VisualizationKey) => void;
  disabledOptions?: Set<VisualizationKey>;
  builtInViews: readonly ViewEntry[];
  gitLabViews?: readonly ViewEntry[];
  gitLabEnabled?: boolean;
  gitLabLoading?: boolean;
  gitLabRefreshing?: boolean;
  gitLabError?: string | null;
  onRefreshGitLab?: () => void;
  onTriggerReanalyze?: () => void;
}

export function SystemSelector({
  value,
  onChange,
  disabledOptions,
  builtInViews,
  gitLabViews = [],
  gitLabEnabled = false,
  gitLabLoading = false,
  gitLabRefreshing = false,
  gitLabError,
  onRefreshGitLab,
  onTriggerReanalyze,
}: SystemSelectorProps) {
  return (
    <div className="fixed top-5 left-5 z-20 flex flex-col gap-2 min-w-[248px] px-3.5 py-3.5 glass-panel">
      <label
        htmlFor="system-selector"
        className="text-xs font-semibold uppercase tracking-wider text-slate-500"
      >
        System
      </label>
      <div className="relative">
        <select
          id="system-selector"
          value={value}
          onChange={(e) => onChange(e.target.value as VisualizationKey)}
          aria-label="Select system flow"
          className="w-full py-3 pl-4 pr-11 rounded-[14px] border border-slate-300/28 bg-white/70 text-slate-900 font-semibold text-[15px] shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] appearance-none -webkit-appearance-none cursor-pointer outline-none focus:border-blue-400/55 focus:shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_0_0_3px_rgba(191,219,254,0.55)]"
        >
          <optgroup label="Built-in">
            {builtInViews.map((opt) => (
              <option
                key={opt.value}
                value={opt.value}
                disabled={disabledOptions?.has(opt.value)}
              >
                {opt.label}
              </option>
            ))}
          </optgroup>
          {gitLabEnabled && gitLabViews.length > 0 && (
            <optgroup label="GitLab">
              {gitLabViews.map((opt) => (
                <option
                  key={opt.value}
                  value={opt.value}
                  disabled={disabledOptions?.has(opt.value)}
                >
                  {opt.label}
                </option>
              ))}
            </optgroup>
          )}
        </select>
        <span className="absolute top-1/2 right-3.5 -translate-y-1/2 w-5 h-5 text-slate-500 pointer-events-none">
          <ChevronDown size={20} />
        </span>
      </div>

      {gitLabEnabled && (
        <div className="flex flex-col gap-2 pt-1">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onRefreshGitLab}
              disabled={gitLabLoading || gitLabRefreshing}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200/60 bg-white/60 px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw size={14} className={gitLabLoading ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button
              type="button"
              onClick={onTriggerReanalyze}
              disabled={gitLabRefreshing}
              className="flex-1 rounded-xl border border-blue-200/60 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {gitLabRefreshing ? 'Triggering...' : 'Reanalyze'}
            </button>
          </div>
          {gitLabError && (
            <p className="max-w-[260px] text-[11px] leading-4 text-rose-600">
              {gitLabError}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
