import type { DiagramEntry, Project } from '@/lib/views/viewRegistry';

interface DiagramSwitcherProps {
  projects: readonly Project[];
  projectId: string;
  value: string;
  onChange: (diagramId: string) => void;
  disabledOptions?: Set<string>;
  getLabel: (diagramId: string) => string;
}

export function DiagramSwitcher({
  projects,
  projectId,
  value,
  onChange,
  disabledOptions,
  getLabel,
}: DiagramSwitcherProps) {
  const project = projects.find((p) => p.id === projectId);
  const diagrams: readonly DiagramEntry[] = project?.diagrams ?? [];

  if (diagrams.length === 0) return null;

  return (
    <div className="fixed left-1/2 -translate-x-1/2 bottom-7 z-20 flex items-center gap-2 px-3 py-2.5 glass-pill">
      {diagrams.map((diagram) => {
        const isActive = diagram.id === value;
        const isDisabled = disabledOptions?.has(diagram.id);
        return (
          <button
            key={diagram.id}
            onClick={() => !isDisabled && onChange(diagram.id)}
            disabled={isDisabled}
            type="button"
            className={`
              h-11 px-5 rounded-full text-sm font-medium whitespace-nowrap
              cursor-pointer transition-all duration-140 ease-in-out
              ${
                isActive
                  ? 'bg-gradient-to-b from-white to-slate-100 text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_8px_18px_rgba(15,23,42,0.12)]'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
              }
              active:not-disabled:scale-[0.97]
              disabled:opacity-45 disabled:cursor-default
            `}
          >
            {getLabel(diagram.id)}
          </button>
        );
      })}
    </div>
  );
}
