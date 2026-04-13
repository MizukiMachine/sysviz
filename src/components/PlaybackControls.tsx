import { Play, Square, SkipBack, SkipForward } from 'lucide-react';
import type { PlaybackInfo } from '@/hooks/usePlayback';

interface PlaybackControlsProps {
  info: PlaybackInfo;
  onPlay: () => void;
  onStop: () => void;
  onNext: () => void;
  onPrev: () => void;
}

export function PlaybackControls({ info, onPlay, onStop, onNext, onPrev }: PlaybackControlsProps) {
  const isPlaying = info.state === 'playing';
  const isIdle = info.state === 'idle';
  const isFirstStep = info.currentStep <= 0;
  const isLastStep = info.currentStep >= info.totalSteps - 1 && info.currentStep >= 0;

  return (
    <div
      className="fixed left-1/2 bottom-7 z-20 flex items-center gap-2.5 px-3.5 py-3 glass-pill"
      aria-label="Playback controls"
    >
      <ControlButton onClick={onPrev} disabled={isFirstStep} ariaLabel="Previous step">
        <SkipBack size={20} />
      </ControlButton>
      <ControlButton onClick={onPlay} disabled={isPlaying} ariaLabel="Play current step">
        <Play size={20} />
      </ControlButton>
      <ControlButton onClick={onStop} disabled={isIdle} ariaLabel="Stop">
        <Square size={18} />
      </ControlButton>
      <ControlButton onClick={onNext} disabled={isLastStep} ariaLabel="Next step">
        <SkipForward size={20} />
      </ControlButton>
    </div>
  );
}

function ControlButton({
  onClick,
  disabled,
  ariaLabel,
  variant = 'default',
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  ariaLabel: string;
  variant?: 'default' | 'stop';
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      type="button"
      className={`
        inline-flex items-center justify-center
        w-11 h-11 p-0 border-0 rounded-full
        cursor-pointer
        transition-all duration-140 ease-in-out
        ${
          variant === 'stop'
            ? 'bg-gradient-to-b from-orange-50 to-amber-100 text-amber-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_8px_18px_rgba(15,23,42,0.12)]'
            : 'bg-gradient-to-b from-white to-slate-100 text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_8px_18px_rgba(15,23,42,0.12)]'
        }
        hover:not-disabled:-translate-y-px hover:not-disabled:shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_12px_24px_rgba(15,23,42,0.16)]
        active:not-disabled:translate-y-0
        disabled:opacity-45 disabled:cursor-default disabled:shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_6px_14px_rgba(15,23,42,0.08)]
      `}
    >
      {children}
    </button>
  );
}
