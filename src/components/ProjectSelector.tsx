import { ChevronDown } from 'lucide-react';
import type { Project } from '@/lib/views/viewRegistry';

interface ProjectSelectorProps {
  projects: readonly Project[];
  value: string;
  onChange: (projectId: string) => void;
}

export function ProjectSelector({
  projects,
  value,
  onChange,
}: ProjectSelectorProps) {
  return (
    <div className="fixed top-5 left-5 z-20 flex w-[200px] max-w-[calc(100%_-_176px)] min-w-0 flex-col gap-2 px-3.5 py-3.5 glass-panel">
      <label
        htmlFor="project-selector"
        className="text-xs font-semibold uppercase tracking-wider text-slate-500"
      >
        Project
      </label>
      <div className="relative">
        <select
          id="project-selector"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Select project"
          className="ui-focus-ring w-full truncate py-3 pl-4 pr-11 rounded-[14px] border border-slate-300/28 bg-white/70 text-slate-900 font-semibold text-[15px] shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] appearance-none -webkit-appearance-none cursor-pointer"
        >
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.label}
            </option>
          ))}
        </select>
        <span className="absolute top-1/2 right-3.5 -translate-y-1/2 w-5 h-5 text-slate-500 pointer-events-none">
          <ChevronDown size={20} />
        </span>
      </div>
    </div>
  );
}
