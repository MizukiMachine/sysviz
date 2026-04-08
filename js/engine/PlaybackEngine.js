const PLAYBACK_DURATION = 8.15;

const TIMELINE_KEYFRAMES = [
    { time: 0.0, type: 'resource', id: 'browser-request', status: 'active' },
    { time: 0.4, type: 'route', id: 'route-conn-browser-wsgi', active: true },
    { time: 1.3, type: 'route', id: 'route-conn-browser-wsgi', active: false },
    { time: 1.3, type: 'resource', id: 'wsgi-server', status: 'active' },
    { time: 1.3, type: 'resource', id: 'browser-request', status: 'complete' },
    { time: 1.75, type: 'route', id: 'route-conn-wsgi-routing', active: true },
    { time: 2.65, type: 'route', id: 'route-conn-wsgi-routing', active: false },
    { time: 2.65, type: 'resource', id: 'routing', status: 'active' },
    { time: 2.65, type: 'resource', id: 'wsgi-server', status: 'complete' },
    { time: 3.1, type: 'route', id: 'route-conn-routing-view', active: true },
    { time: 4.0, type: 'route', id: 'route-conn-routing-view', active: false },
    { time: 4.0, type: 'resource', id: 'view-function', status: 'active' },
    { time: 4.0, type: 'resource', id: 'routing', status: 'complete' },
    { time: 4.45, type: 'route', id: 'route-conn-view-response', active: true },
    { time: 5.35, type: 'route', id: 'route-conn-view-response', active: false },
    { time: 5.35, type: 'resource', id: 'response', status: 'active' },
    { time: 5.35, type: 'resource', id: 'view-function', status: 'complete' },
    { time: 5.8, type: 'route', id: 'route-conn-response-browser', active: true },
    { time: 6.9, type: 'route', id: 'route-conn-response-browser', active: false },
    { time: 6.9, type: 'resource', id: 'browser-render', status: 'active' },
    { time: 6.9, type: 'resource', id: 'response', status: 'complete' }
];

export class PlaybackEngine {
    constructor({
        onStateChange = null,
        onResourceState = null,
        onRouteState = null,
        onReset = null
    } = {}) {
        this.state = 'idle';
        this.elapsed = 0;
        this.duration = PLAYBACK_DURATION;
        this.onStateChange = onStateChange;
        this.onResourceState = onResourceState;
        this.onRouteState = onRouteState;
        this.onReset = onReset;
        this.keyframes = TIMELINE_KEYFRAMES.map((frame) => ({ ...frame }));
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

export { PLAYBACK_DURATION, TIMELINE_KEYFRAMES };
