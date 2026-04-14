import { ChevronDown } from 'lucide-react';

const VIEW_OPTIONS = [
  { value: 'mermaid-data-flow', label: 'Flask: Data Flow (.mmd)' },
] as const;

interface SystemSelectorProps {
  value: string;
  onChange: (value: string) => void;
  disabledOptions?: Set<string>;
}

export function SystemSelector({ value, onChange, disabledOptions }: SystemSelectorProps) {
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
          onChange={(e) => onChange(e.target.value)}
          aria-label="Select system flow"
          className="w-full py-3 pl-4 pr-11 rounded-[14px] border border-slate-300/28 bg-white/70 text-slate-900 font-semibold text-[15px] shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] appearance-none -webkit-appearance-none cursor-pointer outline-none focus:border-blue-400/55 focus:shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_0_0_3px_rgba(191,219,254,0.55)]"
        >
          {VIEW_OPTIONS.map((opt) => (
            <option
              key={opt.value}
              value={opt.value}
              disabled={disabledOptions?.has(opt.value)}
            >
              {opt.label}
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
