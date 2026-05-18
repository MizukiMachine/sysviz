const hints = [
  { button: '左', label: '角度' },
  { button: '右', label: 'パン' },
];

export function InteractionHint() {
  return (
    <div
      className="
        fixed left-5 top-[132px] z-20 w-[200px] pointer-events-none select-none
        rounded-[18px] border border-white/70 bg-white/55 px-3.5 py-2.5
        text-[11px] font-medium text-slate-500 shadow-[0_12px_28px_rgba(15,23,42,0.10)]
        backdrop-blur-xl
      "
      aria-label="操作ヒント"
    >
      <div className="flex items-center justify-between gap-2">
        {hints.map(({ button, label }) => (
          <div key={button} className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-700/80 text-[10px] font-semibold leading-none text-white">
              {button}
            </span>
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
