import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { DiagramEntry, Project } from '@/lib/views/viewRegistry';

interface DiagramSwitcherProps {
  projects: readonly Project[];
  projectId: string;
  value: string;
  onChange: (diagramId: string) => void;
  disabledOptions?: Set<string>;
  getLabel: (diagramId: string) => string;
}

function useIsMobileViewport() {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(max-width: 639px)').matches;
  });

  useEffect(() => {
    const media = window.matchMedia('(max-width: 639px)');
    const handleChange = () => setIsMobile(media.matches);
    handleChange();
    media.addEventListener('change', handleChange);
    window.addEventListener('resize', handleChange);
    return () => {
      media.removeEventListener('change', handleChange);
      window.removeEventListener('resize', handleChange);
    };
  }, []);

  return isMobile;
}

export function DiagramSwitcher({
  projects,
  projectId,
  value,
  onChange,
  disabledOptions,
  getLabel,
}: DiagramSwitcherProps) {
  const isMobile = useIsMobileViewport();
  const project = projects.find((p) => p.id === projectId);
  const diagrams: readonly DiagramEntry[] = project?.diagrams ?? [];

  if (diagrams.length === 0) return null;

  if (isMobile) {
    return (
      <div className="fixed left-5 right-5 top-[182px] z-20">
        <div className="relative rounded-[18px] border border-white/70 bg-white/60 px-1.5 py-1.5 shadow-[0_14px_30px_rgba(15,23,42,0.10)] backdrop-blur-xl">
          <select
            id="diagram-switcher-mobile"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            aria-label="Select diagram"
            className="ui-focus-ring h-10 w-full appearance-none rounded-[14px] border border-slate-300/25 bg-white/70 pl-3.5 pr-10 text-sm font-semibold text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.70)]"
          >
            {diagrams.map((diagram) => (
              <option
                key={diagram.id}
                value={diagram.id}
                disabled={disabledOptions?.has(diagram.id)}
              >
                {getLabel(diagram.id)}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-4 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center text-slate-500">
            <ChevronDown size={18} />
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed left-[240px] right-40 top-7 z-20 flex items-center justify-center pointer-events-none"
      role="tablist"
      aria-label="Diagram views"
    >
      <div className="no-scrollbar pointer-events-auto flex max-w-full items-center gap-1 overflow-x-auto rounded-full border border-white/65 bg-white/38 p-1 shadow-[0_14px_30px_rgba(15,23,42,0.09)] backdrop-blur-xl">
        {diagrams.map((diagram) => {
          const isActive = diagram.id === value;
          const isDisabled = disabledOptions?.has(diagram.id);
          return (
            <button
              key={diagram.id}
              onClick={() => !isDisabled && onChange(diagram.id)}
              disabled={isDisabled}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`
                ui-focus-ring h-9 shrink-0 rounded-full border border-transparent px-3 text-xs font-medium whitespace-nowrap
                cursor-pointer transition-all duration-140 ease-in-out
                ${
                  isActive
                    ? 'bg-gradient-to-b from-white to-slate-100 text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_8px_18px_rgba(15,23,42,0.12)]'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-white/55'
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
    </div>
  );
}
