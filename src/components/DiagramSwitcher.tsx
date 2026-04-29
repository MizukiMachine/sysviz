import type { DiagramEntry, Project } from '@/lib/views/viewRegistry';

interface DiagramSwitcherProps {
  projects: readonly Project[];
  projectId: string;
  value: string;
  onChange: (diagramId: string) => void;
  disabledOptions?: Set<string>;
}

export function DiagramSwitcher({
  projects,
  projectId,
  value,
  onChange,
  disabledOptions,
}: DiagramSwitcherProps) {
  const project = projects.find((p) => p.id === projectId);
  const diagrams: readonly DiagramEntry[] = project?.diagrams ?? [];

  if (diagrams.length === 0) return null;

  return (
    <div className="fixed top-5 left-[232px] z-20 flex flex-col gap-2 min-w-[260px] px-3.5 py-3.5 glass-panel">
      <label
        htmlFor="diagram-switcher"
        className="text-xs font-semibold uppercase tracking-wider text-slate-500"
      >
        Diagram
      </label>
      <div className="relative">
        <select
          id="diagram-switcher"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Select diagram"
          className="w-full py-3 pl-4 pr-11 rounded-[14px] border border-slate-300/28 bg-white/70 text-slate-900 font-semibold text-[15px] shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] appearance-none -webkit-appearance-none cursor-pointer outline-none focus:border-blue-400/55 focus:shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_0_0_3px_rgba(191,219,254,0.55)]"
        >
          {diagrams.map((diagram) => (
            <option
              key={diagram.id}
              value={diagram.id}
              disabled={disabledOptions?.has(diagram.id)}
            >
              {diagram.label}
            </option>
          ))}
        </select>
        <span className="absolute top-1/2 right-3.5 -translate-y-1/2 w-5 h-5 text-slate-500 pointer-events-none">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </div>
    </div>
  );
}
