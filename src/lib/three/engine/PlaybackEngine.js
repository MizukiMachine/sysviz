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
        this.currentStep = stepIndex;
        const step = this.steps[stepIndex];
        const nextStep = stepIndex < this.steps.length - 1 ? this.steps[stepIndex + 1] : null;
        const nextStepTime = stepIndex < this.steps.length - 1
            ? this.steps[stepIndex + 1].time
            : this.duration;

        this.stepLoopMode = true;
        this.stepStart = step.time;
        this.stepEnd = nextStepTime;

        // Set state to playing FIRST so lockDrag is true before any visual changes
        this._setState('playing');

        // 1. Reset all resources + clear routes/particles
        if (this.onReset) this.onReset();

        // 2. Set current + next nodes active so the active route's endpoints are both highlighted
        if (this.onResourceState) {
            this.onResourceState(step.nodeId, 'active');
            if (nextStep) {
                this.onResourceState(nextStep.nodeId, 'active');
            }
        }

        // 3. Set caption
        if (this.onCaption) {
            this.onCaption(step.caption || '');
        }

        // Position elapsed and skip keyframes at stepStart
        this.elapsed = this.stepStart;
        this.nextKeyframeIndex = this.keyframes.findIndex(f => f.time > this.stepStart);
        if (this.nextKeyframeIndex === -1) this.nextKeyframeIndex = this.keyframes.length;

        // Notify step change (camera movement)
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

        // Step loop: check BEFORE draining keyframes to avoid flicker
        if (this.stepLoopMode && this.elapsed >= this.stepEnd) {
            this._loopReset();
            return;
        }

        this._drainKeyframesAtCurrentTime();

        if (this.elapsed >= this.duration) {
            this._setState('idle');
        }
    }

    _loopReset() {
        const step = this.steps[this.currentStep];
        if (!step) return;

        // Restore caption
        if (this.onCaption) {
            this.onCaption(step.caption || '');
        }

        // Rewind elapsed for the same step without clearing in-flight route particles.
        this.elapsed = this.stepStart;
        this.nextKeyframeIndex = this.keyframes.findIndex(f => f.time > this.stepStart);
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
