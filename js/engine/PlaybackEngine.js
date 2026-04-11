export class PlaybackEngine {
    constructor(timeline, {
        onStateChange = null,
        onResourceState = null,
        onRouteState = null,
        onCaption = null,
        onReset = null
    } = {}) {
        this.state = 'idle';
        this.elapsed = 0;
        this.duration = timeline.duration;
        this.onStateChange = onStateChange;
        this.onResourceState = onResourceState;
        this.onRouteState = onRouteState;
        this.onCaption = onCaption;
        this.onReset = onReset;
        this.keyframes = timeline.keyframes.map((frame) => ({ ...frame }));
        this.nextKeyframeIndex = 0;
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
