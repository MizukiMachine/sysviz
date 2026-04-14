import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ResourceMeshFactory } from './ResourceMeshes.js';
import { ConnectionLineManager } from './ConnectionLines.js';
import { ParticleTrafficSystem } from './ParticleTraffic.js';

const BACKGROUND_COLOR = 0xfafafa;
const HIGHLIGHT_COLOR = 0xbfdbfe;
const SELECT_COLOR = 0xfbcfe8;

export class ClusterRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.resourceMeshes = new Map();
        this.selectedResource = null;
        this.hoveredResource = null;
        this.mouse = new THREE.Vector2(-999, -999);
        this._clickStart = new THREE.Vector2();
        this._didDrag = false;
        this.running = false;
        this.frameId = null;
        this.lastFrameTime = 0;
        this._initialCameraPosition = new THREE.Vector3();
        this._initialCameraTarget = new THREE.Vector3();
        this._cameraTargetAnimation = null;
        this.onSelect = null;
        this.onHover = null;
        this.onAnimate = null;
        this.onResourceMoved = null;
        this._draggingResource = null;
        this._groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        this.lockDrag = false;

        this._initScene();
        this._initCamera();
        this._initRenderer();
        this._initControls();
        this._initLights();
        this._initRaycaster();
        this._initSubsystems();
        this._bindEvents();
    }

    _initScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(BACKGROUND_COLOR);
        this.scene.fog = new THREE.FogExp2(0xffffff, 0.012);
    }

    _initCamera() {
        const aspect = this.canvas.clientWidth / this.canvas.clientHeight;
        this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 500);
        this.camera.position.set(2.5, 8, 20);
        this.camera.lookAt(2.5, 0, 0);
        this._initialCameraPosition.copy(this.camera.position);
    }

    _initRenderer() {
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            alpha: false,
            powerPreference: 'high-performance'
        });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.2;
    }

    _initControls() {
        this.controls = new OrbitControls(this.camera, this.canvas);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.08;
        this.controls.enableRotate = true;
        this.controls.enableZoom = true;
        this.controls.enablePan = true;
        this.controls.rotateSpeed = 0.8;
        this.controls.zoomSpeed = 1.2;
        this.controls.panSpeed = 0.8;
        this.controls.minDistance = 5;
        this.controls.maxDistance = 80;
        this.controls.maxPolarAngle = Math.PI / 2.1;
        this.controls.minPolarAngle = 0.1;
        this.controls.target.set(2.5, 0, 0);
        this.controls.mouseButtons = {
            LEFT: THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.PAN,
        };
        this.controls.touches = {
            ONE: THREE.TOUCH.ROTATE,
            TWO: THREE.TOUCH.DOLLY_PAN,
        };
        this._initialCameraTarget.copy(this.controls.target);
        this.controls.update();
    }

    _initLights() {
        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
        this.scene.add(this.ambientLight);

        this.directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
        this.directionalLight.position.set(20, 40, 20);
        this.directionalLight.castShadow = true;
        this.directionalLight.shadow.mapSize.set(2048, 2048);
        this.directionalLight.shadow.camera.left = -40;
        this.directionalLight.shadow.camera.right = 40;
        this.directionalLight.shadow.camera.top = 40;
        this.directionalLight.shadow.camera.bottom = -40;
        this.directionalLight.shadow.camera.near = 0.5;
        this.directionalLight.shadow.camera.far = 100;
        this.directionalLight.shadow.bias = -0.001;
        this.scene.add(this.directionalLight);

        const fillLight = new THREE.DirectionalLight(0xffedd5, 0.45);
        fillLight.position.set(-16, 12, 18);
        this.scene.add(fillLight);

        const rimLight = new THREE.DirectionalLight(0xf8fafc, 0.25);
        rimLight.position.set(-14, 10, -12);
        this.scene.add(rimLight);
    }

    _initRaycaster() {
        this.raycaster = new THREE.Raycaster();
        this.pickableObjects = [];
    }

    _initSubsystems() {
        this.meshFactory = new ResourceMeshFactory();
        this.connectionLines = new ConnectionLineManager(this.scene);
        this.particleTraffic = new ParticleTrafficSystem(this.scene);
    }

    _bindEvents() {
        this._onMouseMove = this._handleMouseMove.bind(this);
        this._onMouseDown = this._handleMouseDown.bind(this);
        this._onMouseUp = this._handleMouseUp.bind(this);
        this._onResize = this._handleResize.bind(this);
        this._onContextMenu = (e) => {
            e.preventDefault();
            e.stopPropagation();
        };

        this.canvas.addEventListener('mousemove', this._onMouseMove);
        this.canvas.addEventListener('mousedown', this._onMouseDown);
        this.canvas.addEventListener('mouseup', this._onMouseUp);
        this.canvas.addEventListener('contextmenu', this._onContextMenu);
        window.addEventListener('resize', this._onResize);
    }

    _handleMouseMove(event) {
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        if (this._draggingResource) {
            const pos = this._raycastGround(this.mouse);
            if (pos) {
                const group = this.resourceMeshes.get(this._draggingResource);
                if (group) {
                    group.position.x = pos.x;
                    group.position.z = pos.z;
                }
            }
            return;
        }

        const dx = event.clientX - this._clickStart.x;
        const dy = event.clientY - this._clickStart.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 4) {
            if (this._cameraTargetAnimation) {
                this._cameraTargetAnimation = null;
            }
            if (this._dragCandidate && !this._didDrag) {
                this._draggingResource = this._dragCandidate;
                this._dragCandidate = null;
                this.controls.enabled = false;
                this.canvas.style.cursor = 'grabbing';
            }
            this._didDrag = true;
        }
    }

    _handleMouseDown(event) {
        if (event.button === 0) {
            if (this.lockDrag) return;
            this._clickStart.set(event.clientX, event.clientY);
            this._didDrag = false;
            this._dragCandidate = null;

            this.raycaster.setFromCamera(this.mouse, this.camera);
            const intersects = this.raycaster.intersectObjects(this.pickableObjects, true);
            if (intersects.length > 0) {
                let target = intersects[0].object;
                while (target.parent && !target.userData.resourceId) {
                    target = target.parent;
                }
                if (target.userData.resourceId) {
                    this._dragCandidate = target.userData.resourceId;
                }
            }
        }
    }

    _handleMouseUp(event) {
        if (this._draggingResource) {
            const rid = this._draggingResource;
            this._draggingResource = null;
            this.controls.enabled = true;
            this.canvas.style.cursor = 'default';
            const group = this.resourceMeshes.get(rid);
            if (group && this.onResourceMoved) {
                this.onResourceMoved(rid, { x: group.position.x, y: 0, z: group.position.z });
            }
            this._didDrag = false;
            return;
        }

        if (event.button === 0 && !this._didDrag) {
            this._performPick(true);
        }
        this._didDrag = false;
        this._dragCandidate = null;
    }

    _handleResize() {
        const width = this.canvas.clientWidth;
        const height = this.canvas.clientHeight;
        this.renderer.setSize(width, height);
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
    }

    _performPick(isClick) {
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.pickableObjects, true);

        if (intersects.length > 0) {
            let target = intersects[0].object;
            while (target.parent && !target.userData.resourceId) {
                target = target.parent;
            }

            if (target.userData.resourceId) {
                if (isClick) {
                    this._setSelected(target.userData.resourceId);
                } else {
                    this._setHovered(target.userData.resourceId);
                }
                return;
            }
        }

        if (isClick) {
            this._setSelected(null);
        } else {
            this._setHovered(null);
        }
    }

    _setSelected(resourceId) {
        if (this.selectedResource === resourceId) return;

        if (this.selectedResource) {
            const prevGroup = this.resourceMeshes.get(this.selectedResource);
            if (prevGroup) this._applyMeshEffect(prevGroup, 'default');
        }

        this.selectedResource = resourceId;

        if (resourceId) {
            const group = this.resourceMeshes.get(resourceId);
            if (group) this._applyMeshEffect(group, 'selected');
        }

        if (this.onSelect) this.onSelect(resourceId);
    }

    _setHovered(resourceId) {
        if (this.hoveredResource === resourceId) return;

        if (this.hoveredResource && this.hoveredResource !== this.selectedResource) {
            const prevGroup = this.resourceMeshes.get(this.hoveredResource);
            if (prevGroup) this._applyMeshEffect(prevGroup, 'default');
        }

        this.hoveredResource = resourceId;
        this.canvas.style.cursor = resourceId ? 'pointer' : 'default';

        if (resourceId && resourceId !== this.selectedResource) {
            const group = this.resourceMeshes.get(resourceId);
            if (group) this._applyMeshEffect(group, 'hovered');
        }

        if (this.onHover) this.onHover(resourceId);
    }

    _applyMeshEffect(group, effect) {
        // Never override nodes that are in active playback state
        if (effect === 'default' && group.userData.isScaled) {
            console.log(`[_applyMeshEffect] SKIP ${group.userData.resourceId} effect=${effect} isScaled=${group.userData.isScaled} (guard blocked)`);
            return;
        }

        const caller = new Error().stack.split('\n').slice(2, 4).map(s => s.trim()).join(' ← ');
        console.log(`[_applyMeshEffect] ${group.userData.resourceId} effect=${effect} lockDrag=${this.lockDrag} isScaled=${group.userData.isScaled} selected=${this.selectedResource} hovered=${this.hoveredResource} | CALLER: ${caller}`);

        group.traverse((child) => {
            if (!child.isMesh || child.userData.isLabel) return;
            const mat = child.material;
            if (!mat) return;

            const hasEmissive = mat.isMeshStandardMaterial || mat.isMeshPhongMaterial || mat.isMeshLambertMaterial;

            switch (effect) {
                case 'selected':
                    if (hasEmissive) {
                        mat.emissiveIntensity = 0.3;
                        mat.emissive.set(SELECT_COLOR);
                    } else if (mat.color) {
                        if (!child.userData.baseColor) child.userData.baseColor = mat.color.getHex();
                        mat.color.set(SELECT_COLOR);
                    }
                    if (child.userData.originalScale) {
                        child.scale.copy(child.userData.originalScale).multiplyScalar(1.08);
                    }
                    break;
                case 'hovered':
                    if (hasEmissive) {
                        mat.emissiveIntensity = 0.18;
                        mat.emissive.set(HIGHLIGHT_COLOR);
                    } else if (mat.color) {
                        if (!child.userData.baseColor) child.userData.baseColor = mat.color.getHex();
                        mat.color.set(HIGHLIGHT_COLOR);
                    }
                    break;
                default:
                    if (hasEmissive) {
                        if (child.userData.baseEmissive) {
                            mat.emissive.copy(child.userData.baseEmissive);
                            mat.emissiveIntensity = child.userData.baseEmissiveIntensity || 0.1;
                        } else {
                            mat.emissiveIntensity = 0.1;
                        }
                    } else if (child.userData.baseColor !== undefined) {
                        mat.color.set(child.userData.baseColor);
                    }
                    if (child.userData.originalScale) {
                        child.scale.copy(child.userData.originalScale);
                    }
                    break;
            }
        });
    }

    addResource(resource) {
        if (this.resourceMeshes.has(resource.id)) return;

        const group = this.meshFactory.create(resource);
        if (!group) return;

        group.userData.resourceId = resource.id;
        group.userData.resourceType = resource.type;
        group.position.set(resource.x || 0, resource.y || 0, resource.z || 0);

        group.traverse((child) => {
            if (child.isMesh) {
                child.userData.resourceId = resource.id;
                child.userData.originalScale = child.scale.clone();
                child.castShadow = true;
                child.receiveShadow = true;
                if (child.material && child.material.emissive) {
                    child.userData.baseEmissive = child.material.emissive.clone();
                    child.userData.baseEmissiveIntensity = child.material.emissiveIntensity;
                }
            }
        });

        this.scene.add(group);
        this.resourceMeshes.set(resource.id, group);
        this._rebuildPickableList();
    }

    removeResource(resourceId) {
        const group = this.resourceMeshes.get(resourceId);
        if (!group) return;

        this.scene.remove(group);
        group.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.dispose());
                } else {
                    child.material.dispose();
                }
            }
        });

        this.resourceMeshes.delete(resourceId);
        this._rebuildPickableList();

        if (this.selectedResource === resourceId) this._setSelected(null);
        if (this.hoveredResource === resourceId) this._setHovered(null);
    }

    updateResource(resource) {
        const group = this.resourceMeshes.get(resource.id);
        if (!group) return;

        if (resource.x !== undefined) group.position.x = resource.x;
        if (resource.y !== undefined) group.position.y = resource.y;
        if (resource.z !== undefined) group.position.z = resource.z;

        if (resource.status) {
            this.meshFactory.updateStatus(group, resource.status);
        }
    }

    setResourceStatus(resourceId, status) {
        const group = this.resourceMeshes.get(resourceId);
        if (!group) {
            console.warn(`[setResourceStatus] UNKNOWN resourceId=${resourceId} status=${status}`);
            return;
        }
        this.meshFactory.updateStatus(group, status);
    }

    _rebuildPickableList() {
        this.pickableObjects = [];
        for (const group of this.resourceMeshes.values()) {
            group.traverse((child) => {
                if (child.isMesh && !child.userData.isLabel) {
                    this.pickableObjects.push(child);
                }
            });
        }
    }

    addConnection(connection) {
        this.connectionLines.addConnection(connection, this.resourceMeshes);
    }

    removeConnection(connectionId) {
        this.connectionLines.removeConnection(connectionId);
    }

    updateConnections() {
        this.connectionLines.updatePositions(this.resourceMeshes);
    }

    addTrafficRoute(route) {
        this.particleTraffic.addRoute(route);
    }

    removeTrafficRoute(routeId) {
        this.particleTraffic.removeRoute(routeId);
    }

    setTrafficRouteActive(routeId, active) {
        this.particleTraffic.setRouteActive(routeId, active);
    }

    setConnectionActive(connectionId, active) {
        this.connectionLines.setConnectionActive(connectionId, active);
    }

    clearTrafficParticles() {
        this.particleTraffic.clearParticles();
    }

    start() {
        if (this.running) return;
        this.running = true;
        this.lastFrameTime = performance.now();
        this._animate();
    }

    stop() {
        this.running = false;
        if (this.frameId) {
            cancelAnimationFrame(this.frameId);
            this.frameId = null;
        }
    }

    // Dump material state of all nodes (for debugging)
    _dumpMaterialSnapshot(label) {
        const states = [];
        for (const [id, group] of this.resourceMeshes) {
            let emissiveHex = '?', emissiveInt = '?';
            group.traverse(child => {
                if (child.isMesh && !child.userData.isLabel && child.material?.emissive) {
                    emissiveHex = '#' + child.material.emissive.getHex().toString(16).padStart(6, '0');
                    emissiveInt = child.material.emissiveIntensity.toFixed(2);
                }
            });
            states.push(`${id}[emis=${emissiveHex}/${emissiveInt} scale=${group.scale.x.toFixed(2)} isScaled=${group.userData.isScaled}]`);
        }
        console.log(`[SNAPSHOT:${label}] ${states.join(' | ')}`);
    }

    _animate() {
        if (!this.running) return;
        this.frameId = requestAnimationFrame(() => this._animate());

        const now = performance.now();
        const delta = (now - this.lastFrameTime) / 1000;
        this.lastFrameTime = now;

        // SNAPSHOT 1: Before onAnimate (engine.update)
        if (this.lockDrag) this._dumpMaterialSnapshot('1-BEFORE-ONANIMATE');

        if (this.onAnimate) {
            this.onAnimate(delta);
        }

        // SNAPSHOT 2: After onAnimate (engine.update may have called _loopReset)
        if (this.lockDrag) this._dumpMaterialSnapshot('2-AFTER-ONANIMATE');

        this._updateCameraTargetAnimation(now);
        this.controls.update();

        if (!this._didDrag && !this.lockDrag) {
            this._performPick(false);
        }

        // SNAPSHOT 3: After _performPick
        if (this.lockDrag) this._dumpMaterialSnapshot('3-AFTER-PICK');

        this.connectionLines.update(delta);

        // SNAPSHOT 4: After connectionLines.update
        if (this.lockDrag) this._dumpMaterialSnapshot('4-AFTER-CONNLINES');

        this.particleTraffic.update(delta);

        // SNAPSHOT 5: After particleTraffic.update
        if (this.lockDrag) this._dumpMaterialSnapshot('5-AFTER-PARTICLES');

        this._animateResources(delta);

        // SNAPSHOT 6: After _animateResources — FINAL pre-render state
        if (this.lockDrag) {
            for (const [id, group] of this.resourceMeshes) {
                if (group.userData.isScaled) {
                    group.traverse(child => {
                        if (child.isMesh && !child.userData.isLabel && child.material?.emissive) {
                            console.log(`[PRE-RENDER-FINAL] ${id} emissive=#${child.material.emissive.getHex().toString(16)} intensity=${child.material.emissiveIntensity.toFixed(2)} scale=${group.scale.x.toFixed(2)}`);
                        }
                    });
                }
            }
        }

        this.renderer.render(this.scene, this.camera);
    }

    _updateCameraTargetAnimation(now) {
        if (!this._cameraTargetAnimation) return;

        const animation = this._cameraTargetAnimation;
        const duration = Math.max(animation.duration, 1);
        const t = Math.min((now - animation.startTime) / duration, 1);
        const ease = t < 0.5
            ? 4 * t * t * t
            : 1 - Math.pow(-2 * t + 2, 3) / 2;

        this.controls.target.lerpVectors(animation.start, animation.end, ease);

        if (animation.startCamera && animation.endCamera) {
            this.camera.position.lerpVectors(animation.startCamera, animation.endCamera, ease);
        }

        if (t >= 1) {
            this.controls.target.copy(animation.end);
            if (animation.endCamera) {
                this.camera.position.copy(animation.endCamera);
            }
            this._cameraTargetAnimation = null;
        }
    }

    _animateResources(delta) {
        const time = performance.now() * 0.001;
        for (const group of this.resourceMeshes.values()) {
            if (group.userData.animate) {
                group.userData.animate(time, delta);
            }
        }
    }

    flyTo(targetPosition, cameraPosition, duration = 1000) {
        this._cameraTargetAnimation = {
            start: this.controls.target.clone(),
            end: targetPosition.clone(),
            startCamera: this.camera.position.clone(),
            endCamera: cameraPosition.clone(),
            startTime: performance.now(),
            duration
        };
    }

    _raycastGround(ndc) {
        this.raycaster.setFromCamera(ndc, this.camera);
        const intersection = new THREE.Vector3();
        const hit = this.raycaster.ray.intersectPlane(this._groundPlane, intersection);
        return hit ? intersection : null;
    }

    resetCamera() {
        this._cameraTargetAnimation = null;
        this.camera.position.copy(this._initialCameraPosition);
        this.controls.target.copy(this._initialCameraTarget);
        this.controls.update();
    }

    dispose() {
        this.stop();

        this.controls.dispose();

        this.canvas.removeEventListener('mousemove', this._onMouseMove);
        this.canvas.removeEventListener('mousedown', this._onMouseDown);
        this.canvas.removeEventListener('mouseup', this._onMouseUp);
        this.canvas.removeEventListener('contextmenu', this._onContextMenu);
        window.removeEventListener('resize', this._onResize);

        for (const id of [...this.resourceMeshes.keys()]) {
            this.removeResource(id);
        }

        this.connectionLines.dispose();
        this.particleTraffic.dispose();
        this.renderer.dispose();
    }
}
