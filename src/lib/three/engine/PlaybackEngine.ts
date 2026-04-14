import type { VisualizationTimeline, VisualizationTimelineKeyframe } from '@/types/visualization';

type PlaybackEngineState = 'idle' | 'playing';

interface ResourceKeyframe extends VisualizationTimelineKeyframe {
  type: 'resource';
  id: string;
  status: string;
  caption?: string;
}

interface RouteKeyframe extends VisualizationTimelineKeyframe {
  type: 'route';
  id: string;
  active: boolean;
  caption?: string;
}

type PlaybackKeyframe = ResourceKeyframe | RouteKeyframe;

interface PlaybackStep {
  time: number;
  nodeId: string;
  caption?: string;
}

interface PlaybackCallbacks {
  onStateChange?: ((state: PlaybackEngineState, info: { elapsed: number; duration: number }) => void) | null;
  onResourceState?: ((resourceId: string, status: string) => void) | null;
  onRouteState?: ((routeId: string, active: boolean) => void) | null;
  onCaption?: ((caption: string) => void) | null;
  onReset?: (() => void) | null;
  onStepChange?: ((nodeId: string, nextNodeId: string | null, caption: string | undefined, stepIndex: number, totalSteps: number) => void) | null;
}

type PlaybackTimeline = VisualizationTimeline & {
  keyframes: PlaybackKeyframe[];
};

export class PlaybackEngine {
  state: PlaybackEngineState;
  elapsed: number;
  duration: number;
  onStateChange: PlaybackCallbacks['onStateChange'];
  onResourceState: PlaybackCallbacks['onResourceState'];
  onRouteState: PlaybackCallbacks['onRouteState'];
  onCaption: PlaybackCallbacks['onCaption'];
  onReset: PlaybackCallbacks['onReset'];
  onStepChange: PlaybackCallbacks['onStepChange'];
  keyframes: PlaybackKeyframe[];
  nextKeyframeIndex: number;
  steps: PlaybackStep[];
  currentStep: number;
  stepLoopMode: boolean;
  stepStart: number;
  stepEnd: number;

  constructor(
    timeline: VisualizationTimeline,
    {
      onStateChange = null,
      onResourceState = null,
      onRouteState = null,
      onCaption = null,
      onReset = null,
      onStepChange = null,
    }: PlaybackCallbacks = {},
  ) {
    this.state = 'idle';
    this.elapsed = 0;
    this.duration = timeline.duration;
    this.onStateChange = onStateChange;
    this.onResourceState = onResourceState;
    this.onRouteState = onRouteState;
    this.onCaption = onCaption;
    this.onReset = onReset;
    this.onStepChange = onStepChange;
    this.keyframes = (timeline as PlaybackTimeline).keyframes.map((frame) => ({ ...frame })) as PlaybackKeyframe[];
    this.nextKeyframeIndex = 0;
    this.steps = [];
    this.currentStep = -1;
    this.stepLoopMode = false;
    this.stepStart = 0;
    this.stepEnd = 0;
    this._extractSteps();
  }

  _extractSteps(): void {
    this.steps = [];
    this.currentStep = -1;
    for (const frame of this.keyframes) {
      if (frame.type === 'resource' && frame.status === 'active') {
        this.steps.push({ time: frame.time, nodeId: frame.id, caption: frame.caption });
      }
    }
  }

  play(): void {
    if (this.steps.length === 0) return;
    if (this.state === 'playing') return;
    if (this.currentStep < 0) this.currentStep = 0;
    this._startStepLoop(this.currentStep);
  }

  stop(): void {
    this.stepLoopMode = false;
    this._rewind();
    this._setState('idle');
    this.currentStep = -1;
  }

  next(): void {
    if (this.steps.length === 0) return;
    if (this.currentStep >= this.steps.length - 1) return;
    this.currentStep++;
    this._startStepLoop(this.currentStep);
  }

  prev(): void {
    if (this.steps.length === 0) return;
    if (this.currentStep <= 0) return;
    this.currentStep--;
    this._startStepLoop(this.currentStep);
  }

  _startStepLoop(stepIndex: number): void {
    this.currentStep = stepIndex;
    const step = this.steps[stepIndex];
    const nextStep = stepIndex < this.steps.length - 1 ? this.steps[stepIndex + 1] : null;
    const nextStepTime = stepIndex < this.steps.length - 1 ? this.steps[stepIndex + 1].time : this.duration;

    this.stepLoopMode = true;
    this.stepStart = step.time;
    this.stepEnd = nextStepTime;

    this._setState('playing');

    if (this.onReset) this.onReset();

    if (this.onResourceState) {
      this.onResourceState(step.nodeId, 'active');
      if (nextStep) {
        this.onResourceState(nextStep.nodeId, 'active');
      }
    }

    if (this.onCaption) {
      this.onCaption(step.caption || '');
    }

    this.elapsed = this.stepStart;
    this.nextKeyframeIndex = this.keyframes.findIndex((f) => f.time > this.stepStart);
    if (this.nextKeyframeIndex === -1) this.nextKeyframeIndex = this.keyframes.length;

    if (this.onStepChange) {
      const nextNodeId = stepIndex < this.steps.length - 1 ? this.steps[stepIndex + 1].nodeId : null;
      this.onStepChange(step.nodeId, nextNodeId, step.caption, stepIndex, this.steps.length);
    }
  }

  update(delta: number): void {
    if (this.state !== 'playing') return;

    this.elapsed += delta;

    if (this.stepLoopMode && this.elapsed >= this.stepEnd) {
      this._loopReset();
      return;
    }

    this._drainKeyframesAtCurrentTime();

    if (this.elapsed >= this.duration) {
      this._setState('idle');
    }
  }

  _loopReset(): void {
    const step = this.steps[this.currentStep];
    if (!step) return;

    if (this.onCaption) {
      this.onCaption(step.caption || '');
    }

    this.elapsed = this.stepStart;
    this.nextKeyframeIndex = this.keyframes.findIndex((f) => f.time > this.stepStart);
    if (this.nextKeyframeIndex === -1) this.nextKeyframeIndex = this.keyframes.length;
  }

  _drainKeyframesAtCurrentTime(): void {
    while (this.nextKeyframeIndex < this.keyframes.length) {
      const frame = this.keyframes[this.nextKeyframeIndex];
      if (frame.time > this.elapsed) break;
      this._applyKeyframe(frame);
      this.nextKeyframeIndex += 1;
    }
  }

  _applyKeyframe(frame: PlaybackKeyframe): void {
    if (frame.caption && this.onCaption) {
      this.onCaption(frame.caption);
    }

    if (frame.type === 'resource' && this.onResourceState) {
      this.onResourceState(frame.id, frame.status);
      if (frame.status === 'active') {
        const idx = this.steps.findIndex((step) => step.nodeId === frame.id);
        if (idx !== -1) this.currentStep = idx;
      }
      return;
    }

    if (frame.type === 'route' && this.onRouteState) {
      this.onRouteState(frame.id, frame.active);
    }
  }

  _rewind(): void {
    this.elapsed = 0;
    this.nextKeyframeIndex = 0;
    if (this.onCaption) this.onCaption('');
    if (this.onReset) {
      this.onReset();
    }
  }

  _setState(nextState: PlaybackEngineState): void {
    if (this.state === nextState) return;
    this.state = nextState;
    if (this.onStateChange) {
      this.onStateChange(nextState, {
        elapsed: this.elapsed,
        duration: this.duration,
      });
    }
  }
}
