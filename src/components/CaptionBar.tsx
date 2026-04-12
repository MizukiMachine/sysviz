interface CaptionBarProps {
  text: string;
  step?: number;
  totalSteps?: number;
}

export function CaptionBar({ text, step, totalSteps }: CaptionBarProps) {
  if (!text) return null;

  return (
    <div
      className="fixed top-8 left-1/2 z-20 max-w-[860px] w-[calc(100%-300px)] px-9 py-5 glass-panel text-center text-slate-900 text-xl font-semibold leading-relaxed tracking-wide pointer-events-none animate-slide-down"
    >
      {step !== undefined && totalSteps !== undefined && step >= 0 && (
        <span className="inline-block mb-1 text-xs font-semibold text-slate-400 tracking-wider uppercase">
          Step {step + 1} / {totalSteps}
        </span>
      )}
      <p>{text}</p>
    </div>
  );
}
