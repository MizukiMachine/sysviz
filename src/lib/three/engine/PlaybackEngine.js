export class PlaybackEngine {
    constructor(timeline, {
        onStateChange = null,
        onResourceState = null,
        onRouteState = null,
        onCaption = null,
        onReset = null,
        onStepChange = null
    } = {}) {
        this.state = 'idle';
        this.elapsed = 0;
        this.duration = timeline.duration;
        this.onStateChange = onStateChange;
        this.onResourceState = onResourceState;
        this.onRouteState = onRouteState;
        this.onCaption = onCaption;
        this.onReset = onReset;
        this.onStepChange = onStepChange;
        this.keyframes = timeline.keyframes.map((frame) => ({ ...frame }));
        this.nextKeyframeIndex = 0;
        this.steps = [];
        this.currentStep = -1;
        this.stepLoopMode = false;
        this.stepStart = 0;
        this.stepEnd = 0;
        this._extractSteps();
    }

    _extractSteps() {
        this.steps = [];
        this.currentStep = -1;
        for (const frame of this.keyframes) {
            if (frame.type === 'resource' && frame.status === 'active') {
                this.steps.push({ time: frame.time, nodeId: frame.id, caption: frame.caption });
            }
        }
    }

    play() {
        if (this.steps.length === 0) return;
        if (this.state === 'playing') return;
        if (this.currentStep < 0) this.currentStep = 0;
        this._startStepLoop(this.currentStep);
    }

    pause() {
        if (this.state !== 'playing') return;
        this._setState('paused');
    }

    stop() {
        this.stepLoopMode = false;
        this._rewind();
        this._setState('idle');
        this.currentStep = -1;
    }

    next() {
        if (this.steps.length === 0) return;
        if (this.currentStep >= this.steps.length - 1) return;
        this.currentStep++;
        this._startStepLoop(this.currentStep);
    }

    prev() {
        if (this.steps.length === 0) return;
        if (this.currentStep <= 0) return;
        this.currentStep--;
        this._startStepLoop(this.currentStep);
    }

    _startStepLoop(stepIndex) {
        const step = this.steps[stepIndex];
        const nextStepTime = stepIndex < this.steps.length - 1
            ? this.steps[stepIndex + 1].time
            : this.duration;

        this.stepLoopMode = true;
        this.stepStart = step.time;
        this.stepEnd = nextStepTime;

        // Reset all resources to idle, then apply baseline (previous steps complete)
        if (this.onReset) this.onReset();
        if (this.onCaption) this.onCaption('');

        // Apply baseline: all keyframes before this step's start time
        for (const frame of this.keyframes) {
            if (frame.time < this.stepStart) {
                this._applyKeyframe(frame);
            }
        }

        // Apply the step's own starting keyframes (node active, caption)
        this.elapsed = this.stepStart;
        this.nextKeyframeIndex = this.keyframes.findIndex(f => f.time >= this.stepStart);
        if (this.nextKeyframeIndex === -1) this.nextKeyframeIndex = this.keyframes.length;
        while (this.nextKeyframeIndex < this.keyframes.length) {
            const frame = this.keyframes[this.nextKeyframeIndex];
            if (frame.time > this.stepStart) break;
            this._applyKeyframe(frame);
            this.nextKeyframeIndex++;
        }

        this._setState('playing');

        // Notify step change (camera movement happens here, not in onResourceState)
        if (this.onStepChange) {
            const nextNodeId = stepIndex < this.steps.length - 1
                ? this.steps[stepIndex + 1].nodeId
                : null;
            this.onStepChange(step.nodeId, nextNodeId, step.caption, stepIndex, this.steps.length);
        }
    }

    update(delta) {
        if (this.state !== 'playing') return;

        this.elapsed += delta;
        this._drainKeyframesAtCurrentTime();

        // Step loop: when the step's time window ends, reset and replay
        if (this.stepLoopMode && this.elapsed >= this.stepEnd) {
            this._loopReset();
            return;
        }

        if (this.elapsed >= this.duration) {
            this._setState('idle');
        }
    }

    _loopReset() {
        const step = this.steps[this.currentStep];
        if (!step) return;

        // Restore current node to active (was set to complete at stepEnd)
        if (this.onResourceState) {
            this.onResourceState(step.nodeId, 'active');
        }

        // Reset next step's node to idle (was activated at stepEnd)
        if (this.currentStep < this.steps.length - 1) {
            const nextNodeId = this.steps[this.currentStep + 1].nodeId;
            if (this.onResourceState) {
                this.onResourceState(nextNodeId, 'idle');
            }
        }

        // Restore caption
        if (this.onCaption) {
            this.onCaption(step.caption || '');
        }

        // Rewind elapsed and keyframe index to step start
        this.elapsed = this.stepStart;
        this.nextKeyframeIndex = this.keyframes.findIndex(f => f.time >= this.stepStart);
        if (this.nextKeyframeIndex === -1) this.nextKeyframeIndex = this.keyframes.length;
    }

    _drainKeyframesAtCurrentTime() {
        while (this.nextKeyframeIndex < this.keyframes.length) {
            const frame = this.keyframes[this.nextKeyframeIndex];
            if (frame.time > this.elapsed) break;
            this._applyKeyframe(frame);
            this.nextKeyframeIndex += 1;
        }
    }

    _applyKeyframe(frame) {
        if (frame.caption && this.onCaption) {
            this.onCaption(frame.caption);
        }

        if (frame.type === 'resource' && this.onResourceState) {
            this.onResourceState(frame.id, frame.status);
            if (frame.status === 'active') {
                const idx = this.steps.findIndex(s => s.nodeId === frame.id);
                if (idx !== -1) this.currentStep = idx;
            }
            return;
        }

        if (frame.type === 'route' && this.onRouteState) {
            this.onRouteState(frame.id, frame.active);
        }
    }

    setTimeline(timeline) {
        this.state = 'idle';
        this.stepLoopMode = false;
        this.elapsed = 0;
        this.duration = timeline.duration;
        this.keyframes = timeline.keyframes.map((frame) => ({ ...frame }));
        this.nextKeyframeIndex = 0;
        this._extractSteps();
    }

    _rewind() {
        this.elapsed = 0;
        this.nextKeyframeIndex = 0;
        if (this.onCaption) this.onCaption('');
        if (this.onReset) {
            this.onReset();
        }
    }

    _setState(nextState) {
        if (this.state === nextState) return;
        this.state = nextState;
        if (this.onStateChange) {
            this.onStateChange(nextState, {
                elapsed: this.elapsed,
                duration: this.duration
            });
        }
    }
}
