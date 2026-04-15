interface CaptionBarProps {
  text: string;
  step?: number;
  totalSteps?: number;
}

export function CaptionBar({ text, step, totalSteps }: CaptionBarProps) {
  if (!text) return null;

  return (
    <div className="fixed left-1/2 -translate-x-1/2 bottom-56 z-20 pointer-events-none select-none">
      <div className="rounded-2xl bg-white/80 backdrop-blur-md shadow-lg px-12 py-6">
        {step !== undefined && totalSteps !== undefined && step >= 0 && (
          <span className="inline-block mb-1.5 text-sm font-semibold text-slate-400 tracking-wider uppercase">
            Step {step + 1} / {totalSteps}
          </span>
        )}
        <p className="text-2xl font-medium leading-relaxed tracking-wide text-slate-800">
          {text}
        </p>
      </div>
    </div>
  );
}
