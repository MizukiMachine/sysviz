import * as THREE from 'three';

const POOL_SIZE = 2048;
const PARTICLE_BASE_SIZE = 3.0;
const PARTICLE_MIN_SPEED = 1.5;
const PARTICLE_MAX_SPEED = 4.0;
const SPAWN_INTERVAL = 0.05;
const TRAIL_LENGTH = 3;
const FADE_IN_DURATION = 0.15;
const FADE_OUT_START = 0.85;
const PARTICLE_LABEL_SCALE = { x: 1.7, y: 0.38, z: 1 };

const TRAFFIC_COLORS = {
    healthy: new THREE.Color(0x3fb950),
    error:   new THREE.Color(0xf85149),
    slow:    new THREE.Color(0xd29922),
    default: new THREE.Color(0x60a5fa)
};

const vertexShader = `
    attribute float size;
    attribute float alpha;
    attribute vec3 color;
    varying float vAlpha;
    varying vec3 vColor;

    void main() {
        vAlpha = alpha;
        vColor = color;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * (200.0 / -mvPosition.z);
        gl_PointSize = max(gl_PointSize, 1.0);
        gl_Position = projectionMatrix * mvPosition;
    }
`;

const fragmentShader = `
    varying float vAlpha;
    varying vec3 vColor;

    void main() {
        vec2 center = gl_PointCoord - vec2(0.5);
        float dist = length(center);
        if (dist > 0.5) discard;

        float intensity = 1.0 - smoothstep(0.0, 0.5, dist);
        float glow = exp(-dist * 4.0) * 0.6;
        float finalAlpha = (intensity + glow) * vAlpha;

        gl_FragColor = vec4(vColor, finalAlpha);
    }
`;

class Particle {
    constructor() {
        this.active = false;
        this.routeId = null;
        this.progress = 0;
        this.speed = 0;
        this.color = new THREE.Color();
        this.alpha = 0;
        this.size = PARTICLE_BASE_SIZE;
        this.trailIndex = 0;
        this.payload = '';
    }

    reset() {
        this.active = false;
        this.routeId = null;
        this.progress = 0;
        this.speed = 0;
        this.alpha = 0;
        this.trailIndex = 0;
        this.payload = '';
    }
}

export class ParticleTrafficSystem {
    constructor(scene) {
        this.scene = scene;
        this.routes = new Map();
        this.particles = [];
        this.activeCount = 0;

        for (let i = 0; i < POOL_SIZE; i++) {
            this.particles.push(new Particle());
        }

        this._initGeometry();
        this._initMaterial();
        this._initPoints();
        this._initLabels();

        this.spawnTimers = new Map();
    }

    _initGeometry() {
        this.geometry = new THREE.BufferGeometry();
        this.positions = new Float32Array(POOL_SIZE * 3);
        this.colors = new Float32Array(POOL_SIZE * 3);
        this.sizes = new Float32Array(POOL_SIZE);
        this.alphas = new Float32Array(POOL_SIZE);

        this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
        this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
        this.geometry.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));
        this.geometry.setAttribute('alpha', new THREE.BufferAttribute(this.alphas, 1));

        for (let i = 0; i < POOL_SIZE; i++) {
            this.positions[i * 3] = 0;
            this.positions[i * 3 + 1] = -1000;
            this.positions[i * 3 + 2] = 0;
            this.sizes[i] = 0;
            this.alphas[i] = 0;
        }
    }

    _initMaterial() {
        this.material = new THREE.ShaderMaterial({
            vertexShader,
            fragmentShader,
            transparent: true,
            depthWrite: false,
            blending: THREE.NormalBlending
        });
    }

    _initPoints() {
        this.pointCloud = new THREE.Points(this.geometry, this.material);
        this.pointCloud.frustumCulled = false;
        this.scene.add(this.pointCloud);
    }

    _initLabels() {
        this.labelTextures = new Map();
        this.labelSprites = new Array(POOL_SIZE);

        for (let i = 0; i < POOL_SIZE; i++) {
            const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
                transparent: true,
                depthTest: false,
                sizeAttenuation: true,
                opacity: 0
            }));
            sprite.visible = false;
            sprite.renderOrder = 12;
            sprite.scale.set(
                PARTICLE_LABEL_SCALE.x,
                PARTICLE_LABEL_SCALE.y,
                PARTICLE_LABEL_SCALE.z
            );
            this.labelSprites[i] = sprite;
            this.scene.add(sprite);
        }
    }

    _getLabelTexture(text) {
        const label = text || '';
        if (this.labelTextures.has(label)) {
            return this.labelTextures.get(label);
        }

        const canvas = document.createElement('canvas');
        canvas.width = 768;
        canvas.height = 112;
        const ctx = canvas.getContext('2d');

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = '600 24px "Inter", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const textWidth = Math.min(ctx.measureText(label).width + 34, canvas.width - 12);
        const boxHeight = 56;
        const boxX = (canvas.width - textWidth) / 2;
        const boxY = (canvas.height - boxHeight) / 2;
        const radius = 14;

        ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
        ctx.beginPath();
        ctx.moveTo(boxX + radius, boxY);
        ctx.lineTo(boxX + textWidth - radius, boxY);
        ctx.quadraticCurveTo(boxX + textWidth, boxY, boxX + textWidth, boxY + radius);
        ctx.lineTo(boxX + textWidth, boxY + boxHeight - radius);
        ctx.quadraticCurveTo(boxX + textWidth, boxY + boxHeight, boxX + textWidth - radius, boxY + boxHeight);
        ctx.lineTo(boxX + radius, boxY + boxHeight);
        ctx.quadraticCurveTo(boxX, boxY + boxHeight, boxX, boxY + boxHeight - radius);
        ctx.lineTo(boxX, boxY + radius);
        ctx.quadraticCurveTo(boxX, boxY, boxX + radius, boxY);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#0f172a';
        ctx.fillText(label, canvas.width / 2, canvas.height / 2, canvas.width - 48);

        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        this.labelTextures.set(label, texture);
        return texture;
    }

    _setParticleLabel(index, particle, route) {
        const sprite = this.labelSprites[index];
        if (!sprite) return;

        if (!particle.active || !route?.payload) {
            sprite.visible = false;
            sprite.material.opacity = 0;
            return;
        }

        if (sprite.userData.payload !== route.payload) {
            sprite.material.map = this._getLabelTexture(route.payload);
            sprite.material.needsUpdate = true;
            sprite.userData.payload = route.payload;
        }

        sprite.position.set(
            this.positions[index * 3],
            this.positions[index * 3 + 1] + 0.34 + particle.trailIndex * 0.02,
            this.positions[index * 3 + 2]
        );
        sprite.material.opacity = particle.alpha * Math.max(0.35, 0.95 - particle.trailIndex * 0.2);
        sprite.visible = sprite.material.opacity > 0.01;
    }

    addRoute(route) {
        if (this.routes.has(route.id)) return;

        const curve = this._buildCurve(route);
        if (!curve) return;

        this.routes.set(route.id, {
            id: route.id,
            curve,
            sourceId: route.sourceId,
            targetId: route.targetId,
            payload: route.payload || '',
            trafficType: route.trafficType || 'default',
            requestRate: route.requestRate || 1,
            color: TRAFFIC_COLORS[route.trafficType] || TRAFFIC_COLORS.default,
            active: true
        });

        this.spawnTimers.set(route.id, 0);
    }

    removeRoute(routeId) {
        this.routes.delete(routeId);
        this.spawnTimers.delete(routeId);

        for (const particle of this.particles) {
            if (particle.active && particle.routeId === routeId) {
                this._deactivateParticle(particle);
            }
        }
    }

    updateRoute(routeId, updates) {
        const route = this.routes.get(routeId);
        if (!route) return;

        if (updates.requestRate !== undefined) route.requestRate = updates.requestRate;
        if (updates.payload !== undefined) route.payload = updates.payload;
        if (updates.trafficType !== undefined) {
            route.trafficType = updates.trafficType;
            route.color = TRAFFIC_COLORS[updates.trafficType] || TRAFFIC_COLORS.default;
        }
        if (updates.sourcePos || updates.targetPos) {
            route.curve = this._buildCurve({
                sourcePos: updates.sourcePos || route.curve.v0,
                targetPos: updates.targetPos || route.curve.v2,
                ...route
            });
        }
    }

    _toVector3(pos) {
        if (pos instanceof THREE.Vector3) return pos;
        return new THREE.Vector3(pos.x, pos.y, pos.z);
    }

    _buildCurve(route) {
        if (!route.sourcePos || !route.targetPos) {
            return route.curve || null;
        }

        const start = this._toVector3(route.sourcePos);
        const end = this._toVector3(route.targetPos);

        const mid = new THREE.Vector3().lerpVectors(start, end, 0.5);
        const dist = start.distanceTo(end);
        mid.y += Math.min(dist * 0.25, 2.5);

        return new THREE.QuadraticBezierCurve3(start, mid, end);
    }

    _acquireParticle() {
        for (let i = 0; i < POOL_SIZE; i++) {
            if (!this.particles[i].active) {
                return { particle: this.particles[i], index: i };
            }
        }
        return null;
    }

    _deactivateParticle(particle) {
        const idx = this.particles.indexOf(particle);
        if (idx === -1) return;

        const sprite = this.labelSprites[idx];
        if (sprite) {
            sprite.visible = false;
            sprite.material.opacity = 0;
            sprite.userData.payload = null;
        }

        particle.reset();
        this.positions[idx * 3 + 1] = -1000;
        this.sizes[idx] = 0;
        this.alphas[idx] = 0;
        this.activeCount--;
    }

    _spawnParticle(route) {
        const slot = this._acquireParticle();
        if (!slot) return;

        const { particle, index } = slot;
        particle.active = true;
        particle.routeId = route.id;
        particle.progress = 0;
        particle.speed = PARTICLE_MIN_SPEED + Math.random() * (PARTICLE_MAX_SPEED - PARTICLE_MIN_SPEED);
        particle.color.copy(route.color);
        particle.alpha = 0;
        particle.size = PARTICLE_BASE_SIZE * (0.7 + Math.random() * 0.6);
        particle.trailIndex = 0;
        particle.payload = route.payload;

        this.colors[index * 3] = route.color.r;
        this.colors[index * 3 + 1] = route.color.g;
        this.colors[index * 3 + 2] = route.color.b;

        this.activeCount++;
    }

    update(delta) {
        this._spawnNewParticles(delta);
        this._updateActiveParticles(delta);
        this._flushBuffers();
    }

    _spawnNewParticles(delta) {
        for (const [routeId, route] of this.routes) {
            if (!route.active) continue;

            let timer = this.spawnTimers.get(routeId) || 0;
            timer += delta;

            const interval = SPAWN_INTERVAL / Math.max(route.requestRate, 0.1);
            while (timer >= interval) {
                timer -= interval;
                this._spawnParticle(route);

                for (let t = 0; t < TRAIL_LENGTH - 1; t++) {
                    const trailSlot = this._acquireParticle();
                    if (!trailSlot) break;
                    const { particle: trail, index: trailIdx } = trailSlot;
                    trail.active = true;
                    trail.routeId = route.id;
                    trail.progress = -(t + 1) * 0.03;
                    trail.speed = PARTICLE_MIN_SPEED + Math.random() * (PARTICLE_MAX_SPEED - PARTICLE_MIN_SPEED);
                    trail.color.copy(route.color);
                    trail.alpha = 0;
                    trail.size = PARTICLE_BASE_SIZE * (0.5 - t * 0.12);
                    trail.trailIndex = t + 1;
                    trail.payload = route.payload;

                    this.colors[trailIdx * 3] = route.color.r * (1 - t * 0.2);
                    this.colors[trailIdx * 3 + 1] = route.color.g * (1 - t * 0.2);
                    this.colors[trailIdx * 3 + 2] = route.color.b * (1 - t * 0.2);
                }
            }

            this.spawnTimers.set(routeId, timer);
        }
    }

    _updateActiveParticles(delta) {
        const tmpVec = new THREE.Vector3();

        for (let i = 0; i < POOL_SIZE; i++) {
            const particle = this.particles[i];
            if (!particle.active) continue;

            const route = this.routes.get(particle.routeId);
            if (!route || !route.curve) {
                this._deactivateParticle(particle);
                continue;
            }

            particle.progress += particle.speed * delta / route.curve.getLength();

            if (particle.progress >= 1.0) {
                this._deactivateParticle(particle);
                continue;
            }

            const t = Math.max(0, Math.min(1, particle.progress));
            route.curve.getPoint(t, tmpVec);

            this.positions[i * 3] = tmpVec.x;
            this.positions[i * 3 + 1] = tmpVec.y;
            this.positions[i * 3 + 2] = tmpVec.z;

            let alpha = 1.0;
            if (t < FADE_IN_DURATION) {
                alpha = t / FADE_IN_DURATION;
            } else if (t > FADE_OUT_START) {
                alpha = 1.0 - (t - FADE_OUT_START) / (1.0 - FADE_OUT_START);
            }
            alpha *= (1.0 - particle.trailIndex * 0.3);
            particle.alpha = Math.max(0, alpha);

            this.alphas[i] = particle.alpha;
            this.sizes[i] = particle.size * (particle.alpha * 0.5 + 0.5);
            this._setParticleLabel(i, particle, route);
        }
    }

    _flushBuffers() {
        this.geometry.attributes.position.needsUpdate = true;
        this.geometry.attributes.color.needsUpdate = true;
        this.geometry.attributes.size.needsUpdate = true;
        this.geometry.attributes.alpha.needsUpdate = true;
    }

    syncRoutes(routesMap) {
        const newIds = new Set();

        for (const [id, route] of routesMap) {
            newIds.add(id);
            if (this.routes.has(id)) {
                this.updateRoute(id, route);
            } else {
                this.addRoute(route);
            }
        }

        for (const id of [...this.routes.keys()]) {
            if (!newIds.has(id)) {
                this.removeRoute(id);
            }
        }
    }

    setRouteActive(routeId, active) {
        const route = this.routes.get(routeId);
        if (route) route.active = active;
    }

    getActiveParticleCount() {
        return this.activeCount;
    }

    getRouteCount() {
        return this.routes.size;
    }

    clearParticles() {
        for (const particle of this.particles) {
            if (particle.active) {
                this._deactivateParticle(particle);
            }
        }
        for (const routeId of this.spawnTimers.keys()) {
            this.spawnTimers.set(routeId, 0);
        }
        for (const sprite of this.labelSprites) {
            sprite.visible = false;
            sprite.material.opacity = 0;
        }
        this._flushBuffers();
    }

    dispose() {
        for (const particle of this.particles) {
            particle.reset();
        }
        this.routes.clear();
        this.spawnTimers.clear();
        this.activeCount = 0;

        this.scene.remove(this.pointCloud);
        for (const sprite of this.labelSprites) {
            this.scene.remove(sprite);
            sprite.material.dispose();
        }
        for (const texture of this.labelTextures.values()) {
            texture.dispose();
        }
        this.geometry.dispose();
        this.material.dispose();
    }
}
