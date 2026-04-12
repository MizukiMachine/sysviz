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
        if (this.state === 'playing') return;

        if (this.state === 'idle') {
            this._rewind();
            this._drainKeyframesAtCurrentTime();
        }

        this._setState('playing');
    }

    pause() {
        if (this.state !== 'playing') return;
        this._setState('paused');
    }

    stop() {
        this._rewind();
        this._setState('idle');
        this.currentStep = -1;
    }

    next() {
        if (this.steps.length === 0) return;
        if (this.currentStep >= this.steps.length - 1) return;
        this.currentStep++;
        this._goToStep(this.currentStep);
    }

    prev() {
        if (this.steps.length === 0) return;
        if (this.currentStep <= 0) return;
        this.currentStep--;
        this._goToStep(this.currentStep);
    }

    _goToStep(stepIndex) {
        if (this.onReset) this.onReset();
        if (this.onCaption) this.onCaption('');

        const step = this.steps[stepIndex];
        const applyUntilTime = step.time + 1.5;

        let lastAppliedIndex = -1;
        for (let i = 0; i < this.keyframes.length; i++) {
            if (this.keyframes[i].time <= applyUntilTime) {
                this._applyKeyframe(this.keyframes[i]);
                lastAppliedIndex = i;
            } else {
                break;
            }
        }

        this.nextKeyframeIndex = lastAppliedIndex + 1;
        this.elapsed = step.time + 1.5;

        this.state = 'paused';
        if (this.onStateChange) {
            this.onStateChange('paused', { elapsed: this.elapsed, duration: this.duration });
        }

        if (this.onStepChange) {
            const nextNodeId = stepIndex < this.steps.length - 1
                ? this.steps[stepIndex + 1].nodeId
                : null;
            this.onStepChange(step.nodeId, nextNodeId, step.caption, stepIndex, this.steps.length);
        }
    }

    update(delta) {
        if (this.state !== 'playing') return;

        this.elapsed = Math.min(this.elapsed + delta, this.duration);
        this._drainKeyframesAtCurrentTime();

        if (this.elapsed >= this.duration) {
            this._setState('idle');
        }
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
