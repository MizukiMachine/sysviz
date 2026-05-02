import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ResourceMeshFactory } from './ResourceMeshes.js';
import { ConnectionLineManager } from './ConnectionLines.js';
import { ParticleTrafficSystem } from './ParticleTraffic.js';
import type { ClusterBounds, VisualizationCamera, VisualizationConnection, VisualizationNode, VisualizationRoute, VisualizationResourceStatus } from '@/types/visualization';

const BACKGROUND_COLOR = 0xfafafa;
const HIGHLIGHT_COLOR = 0xbfdbfe;
const SELECT_COLOR = 0xfbcfe8;
const CAMERA_FRAME_PADDING = 1.10;
const LABEL_FULL_DISTANCE = 18;
const LABEL_SHORT_DISTANCE = 34;

type MeshEffect = 'default' | 'selected' | 'hovered';
type PickableObject = THREE.Object3D;

interface CameraTargetAnimation {
  start: THREE.Vector3;
  end: THREE.Vector3;
  startCamera: THREE.Vector3;
  endCamera: THREE.Vector3;
  startTime: number;
  duration: number;
}

type ResourceObject3D = THREE.Object3D & {
  geometry?: { dispose: () => void };
  material?: THREE.Material | THREE.Material[];
  isMesh?: boolean;
  castShadow?: boolean;
  receiveShadow?: boolean;
};

interface ResourceUserData {
  resourceId?: string;
  resourceType?: string;
  isScaled?: boolean;
  isLabel?: boolean;
  labelAnchor?: THREE.Vector3;
  labels?: {
    shortName: THREE.Object3D;
    fullName: THREE.Object3D;
    dataIn?: THREE.Object3D;
    dataOut?: THREE.Object3D;
  };
  originalScale?: THREE.Vector3;
  baseColor?: number;
  baseEmissive?: THREE.Color;
  baseEmissiveIntensity?: number;
  animate?: (time: number, delta: number) => void;
}

export class ClusterRenderer {
  canvas: HTMLCanvasElement;
  scene!: THREE.Scene;
  camera!: THREE.PerspectiveCamera;
  renderer!: THREE.WebGLRenderer;
  controls!: OrbitControls;
  ambientLight!: THREE.AmbientLight;
  directionalLight!: THREE.DirectionalLight;
  raycaster!: THREE.Raycaster;
  pickableObjects: PickableObject[];
  meshFactory: ResourceMeshFactory;
  resourceMeshes: Map<string, THREE.Group>;
  connectionLines: ConnectionLineManager;
  clusterBounds: Map<string, ClusterBounds> | undefined;
  particleTraffic: ParticleTrafficSystem;
  selectedResource: string | null;
  hoveredResource: string | null;
  mouse: THREE.Vector2;
  _clickStart: THREE.Vector2;
  _didDrag: boolean;
  running: boolean;
  frameId: number | null;
  lastFrameTime: number;
  _initialCameraPosition: THREE.Vector3;
  _initialCameraTarget: THREE.Vector3;
  _cameraTargetAnimation: CameraTargetAnimation | null;
  onSelect: ((resourceId: string | null) => void) | null;
  onHover: ((resourceId: string | null) => void) | null;
  _onMouseMove!: (event: MouseEvent) => void;
  _onMouseDown!: (event: MouseEvent) => void;
  _onMouseUp!: (event: MouseEvent) => void;
  _onResize!: () => void;
  _onContextMenu!: (event: MouseEvent) => void;

  constructor(canvas: HTMLCanvasElement) {
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
    this.pickableObjects = [];
    this.meshFactory = new ResourceMeshFactory();

    this._initScene();
    this._initCamera();
    this._initRenderer();
    this._initControls();
    this._initLights();
    this._initRaycaster();
    this.connectionLines = new ConnectionLineManager(this.scene);
    this.clusterBounds = undefined;
    this.particleTraffic = new ParticleTrafficSystem(this.scene);
    this._bindEvents();
  }

  _initScene(): void {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(BACKGROUND_COLOR);
    this.scene.fog = new THREE.FogExp2(0xffffff, 0.005);
  }

  _initCamera(): void {
    const aspect = this.canvas.clientWidth / this.canvas.clientHeight;
    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 500);
    this.camera.position.set(2.5, 6, 14);
    this.camera.lookAt(2.5, 0, 0);
    this._initialCameraPosition.copy(this.camera.position);
  }

  _initRenderer(): void {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
  }

  _initControls(): void {
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
    const lockedAzimuth = this.controls.getAzimuthalAngle();
    this.controls.minAzimuthAngle = lockedAzimuth;
    this.controls.maxAzimuthAngle = lockedAzimuth;
  }

  _initLights(): void {
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

  _initRaycaster(): void {
    this.raycaster = new THREE.Raycaster();
    this.pickableObjects = [];
  }

  _bindEvents(): void {
    this._onMouseMove = this._handleMouseMove.bind(this);
    this._onMouseDown = this._handleMouseDown.bind(this);
    this._onMouseUp = this._handleMouseUp.bind(this);
    this._onResize = this._handleResize.bind(this);
    this._onContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
    };

    this.canvas.addEventListener('mousemove', this._onMouseMove);
    this.canvas.addEventListener('mousedown', this._onMouseDown);
    this.canvas.addEventListener('mouseup', this._onMouseUp);
    this.canvas.addEventListener('contextmenu', this._onContextMenu);
    window.addEventListener('resize', this._onResize);
  }

  _handleMouseMove(event: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    const dx = event.clientX - this._clickStart.x;
    const dy = event.clientY - this._clickStart.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 4) {
      if (this._cameraTargetAnimation) {
        this._cameraTargetAnimation = null;
      }
      this._didDrag = true;
    }
  }

  _handleMouseDown(event: MouseEvent): void {
    if (event.button === 0) {
      this._clickStart.set(event.clientX, event.clientY);
      this._didDrag = false;
    }
  }

  _handleMouseUp(event: MouseEvent): void {
    if (event.button === 0 && !this._didDrag) {
      this._performPick(true);
    }
    this._didDrag = false;
  }

  _handleResize(): void {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  _performPick(isClick: boolean): void {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.pickableObjects, true);

    if (intersects.length > 0) {
      let target = intersects[0].object;
      while (target.parent && !(target.userData as ResourceUserData).resourceId) {
        target = target.parent;
      }

      const resourceId = (target.userData as ResourceUserData).resourceId;
      if (resourceId) {
        if (isClick) {
          this._setSelected(resourceId);
        } else {
          this._setHovered(resourceId);
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

  _setSelected(resourceId: string | null): void {
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

  _setHovered(resourceId: string | null): void {
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

  _applyMeshEffect(group: THREE.Group, effect: MeshEffect): void {
    if (effect === 'default' && (group.userData as ResourceUserData).isScaled) {
      return;
    }

    group.traverse((child) => {
      const object = child as ResourceObject3D;
      const userData = object.userData as ResourceUserData;
      if (!object.isMesh || userData.isLabel) return;
      const mat = object.material as THREE.Material & {
        emissive?: THREE.Color;
        emissiveIntensity?: number;
        color?: THREE.Color;
        isMeshStandardMaterial?: boolean;
        isMeshPhongMaterial?: boolean;
        isMeshLambertMaterial?: boolean;
      };
      if (!mat) return;

      const hasEmissive = Boolean(mat.isMeshStandardMaterial || mat.isMeshPhongMaterial || mat.isMeshLambertMaterial);

      switch (effect) {
        case 'selected':
          if (hasEmissive && mat.emissive) {
            mat.emissiveIntensity = 0.3;
            mat.emissive.set(SELECT_COLOR);
          } else if (mat.color) {
            if (!userData.baseColor) userData.baseColor = mat.color.getHex();
            mat.color.set(SELECT_COLOR);
          }
          if (userData.originalScale) {
            object.scale.copy(userData.originalScale).multiplyScalar(1.08);
          }
          break;
        case 'hovered':
          if (hasEmissive && mat.emissive) {
            mat.emissiveIntensity = 0.18;
            mat.emissive.set(HIGHLIGHT_COLOR);
          } else if (mat.color) {
            if (!userData.baseColor) userData.baseColor = mat.color.getHex();
            mat.color.set(HIGHLIGHT_COLOR);
          }
          break;
        default:
          if (hasEmissive && mat.emissive) {
            if (userData.baseEmissive) {
              mat.emissive.copy(userData.baseEmissive);
              mat.emissiveIntensity = userData.baseEmissiveIntensity || 0.1;
            } else {
              mat.emissiveIntensity = 0.1;
            }
          } else if (userData.baseColor !== undefined && mat.color) {
            mat.color.set(userData.baseColor);
          }
          if (userData.originalScale) {
            object.scale.copy(userData.originalScale);
          }
          break;
      }
    });
  }

  addResource(resource: VisualizationNode): void {
    if (this.resourceMeshes.has(resource.id)) return;

    const group = this.meshFactory.create(resource);
    if (!group) return;

    const userData = group.userData as ResourceUserData;
    userData.resourceId = resource.id;
    userData.resourceType = typeof resource.type === 'string' ? resource.type : undefined;
    const halfHeight = (group.userData as ResourceUserData & { halfHeight?: number }).halfHeight ?? 0.65;
    group.position.set(resource.x || 0, (resource.y || 0) + halfHeight, resource.z || 0);

    group.traverse((child) => {
      const object = child as ResourceObject3D;
      const objectUserData = object.userData as ResourceUserData;
      const material = object.material as (THREE.Material & {
        emissive?: THREE.Color;
        emissiveIntensity?: number;
      }) | undefined;

      objectUserData.resourceId = resource.id;
      objectUserData.originalScale = object.scale.clone();

      if (object.isMesh) {
        object.castShadow = true;
        object.receiveShadow = true;
        if (material?.emissive) {
          objectUserData.baseEmissive = material.emissive.clone();
          objectUserData.baseEmissiveIntensity = material.emissiveIntensity;
        }
      }
    });

    this.scene.add(group);
    this.resourceMeshes.set(resource.id, group);
    this._rebuildPickableList();
  }

  removeResource(resourceId: string): void {
    const group = this.resourceMeshes.get(resourceId);
    if (!group) return;

    this.scene.remove(group);
    group.traverse((child) => {
      const object = child as ResourceObject3D;
      object.geometry?.dispose();
      if (!object.material) return;
      if (Array.isArray(object.material)) {
        object.material.forEach((material) => material.dispose());
      } else {
        object.material.dispose();
      }
    });

    this.resourceMeshes.delete(resourceId);
    this._rebuildPickableList();

    if (this.selectedResource === resourceId) this._setSelected(null);
    if (this.hoveredResource === resourceId) this._setHovered(null);
  }

  updateResource(resource: VisualizationNode): void {
    const group = this.resourceMeshes.get(resource.id);
    if (!group) return;

    if (resource.x !== undefined) group.position.x = resource.x;
    if (resource.y !== undefined) group.position.y = resource.y;
    if (resource.z !== undefined) group.position.z = resource.z;

    if (resource.status) {
      this.meshFactory.updateStatus(group, resource.status);
    }
  }

  setResourceStatus(resourceId: string, status: VisualizationResourceStatus): void {
    const group = this.resourceMeshes.get(resourceId);
    if (!group) {
      console.warn(`[setResourceStatus] UNKNOWN resourceId=${resourceId} status=${status}`);
      return;
    }
    this.meshFactory.updateStatus(group, status);
  }

  _rebuildPickableList(): void {
    this.pickableObjects = [];
    for (const group of this.resourceMeshes.values()) {
      group.traverse((child) => {
        const object = child as ResourceObject3D;
        if (object.isMesh && !(object.userData as ResourceUserData).isLabel) {
          this.pickableObjects.push(object as THREE.Object3D);
        }
      });
    }
  }

  addConnection(connection: VisualizationConnection, clusterBounds?: Map<string, ClusterBounds>): void {
    this.clusterBounds = clusterBounds;
    this.connectionLines.addConnection(connection, this.resourceMeshes, clusterBounds);
  }

  removeConnection(connectionId: string): void {
    this.connectionLines.removeConnection(connectionId);
  }

  updateConnections(clusterBounds?: Map<string, ClusterBounds>): void {
    this.clusterBounds = clusterBounds;
    this.connectionLines.updatePositions(this.resourceMeshes, clusterBounds);
  }

  addTrafficRoute(route: VisualizationRoute): void {
    this.particleTraffic.addRoute(route);
  }

  applyCamera(cameraView: VisualizationCamera): void {
    const position = new THREE.Vector3(...cameraView.position);
    const target = new THREE.Vector3(...cameraView.target);
    this._cameraTargetAnimation = null;
    this.camera.position.copy(position);
    this.controls.target.copy(target);
    this.camera.lookAt(target);
    this.camera.updateProjectionMatrix();
    this.controls.update();
    this._initialCameraPosition.copy(this.camera.position);
    this._initialCameraTarget.copy(this.controls.target);
  }

  frameBounds(bounds: ClusterBounds): void {
    this._frameRegion(bounds.minX, bounds.maxX, bounds.minZ, bounds.maxZ);
  }

  frameResources(clusterBounds?: Map<string, ClusterBounds>): void {
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;

    for (const group of this.resourceMeshes.values()) {
      minX = Math.min(minX, group.position.x);
      maxX = Math.max(maxX, group.position.x);
      minZ = Math.min(minZ, group.position.z);
      maxZ = Math.max(maxZ, group.position.z);
    }

    for (const bounds of clusterBounds?.values() ?? []) {
      minX = Math.min(minX, bounds.minX);
      maxX = Math.max(maxX, bounds.maxX);
      minZ = Math.min(minZ, bounds.minZ);
      maxZ = Math.max(maxZ, bounds.maxZ);
    }

    if (!Number.isFinite(minX)) {
      this.resetCamera();
      return;
    }

    this._frameRegion(minX, maxX, minZ, maxZ);
  }

  private _frameRegion(minX: number, maxX: number, minZ: number, maxZ: number): void {
    const cx = (minX + maxX) / 2;
    const cz = (minZ + maxZ) / 2;
    const paddedWidth = Math.max(maxX - minX + 3, 9);
    const paddedDepth = Math.max(maxZ - minZ + 3, 9);
    const aspect = this.camera.aspect || this.canvas.clientWidth / Math.max(this.canvas.clientHeight, 1) || 1;
    const halfFov = THREE.MathUtils.degToRad(this.camera.fov) / 2;
    const tanHalfFov = Math.tan(halfFov);

    const distanceForWidth = (paddedWidth / 2) / Math.max(tanHalfFov * aspect, 0.001);
    const distanceForDepth = (paddedDepth / 2) / Math.max(tanHalfFov, 0.001);
    const distance = Math.max(distanceForWidth, distanceForDepth, 15) * CAMERA_FRAME_PADDING;
    const elevation = THREE.MathUtils.degToRad(35);

    const target = new THREE.Vector3(cx, 0, cz);
    const position = new THREE.Vector3(
      cx,
      distance * Math.sin(elevation) + 2,
      cz + distance * Math.cos(elevation),
    );

    this.controls.maxDistance = Math.max(80, position.distanceTo(target) * 2);
    this.camera.far = Math.max(500, position.distanceTo(target) * 4);
    this.camera.position.copy(position);
    this.controls.target.copy(target);
    this.camera.lookAt(target);
    this.camera.updateProjectionMatrix();
    this.controls.update();

    this._initialCameraPosition.copy(this.camera.position);
    this._initialCameraTarget.copy(this.controls.target);
  }
  removeTrafficRoute(routeId: string): void {
    this.particleTraffic.removeRoute(routeId);
  }

  setTrafficRouteActive(routeId: string, active: boolean): void {
    this.particleTraffic.setRouteActive(routeId, active);
  }

  setConnectionActive(connectionId: string, active: boolean): void {
    this.connectionLines.setConnectionActive(connectionId, active);
  }

  clearTrafficParticles(): void {
    this.particleTraffic.clearParticles();
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastFrameTime = performance.now();
    this._animate();
  }

  stop(): void {
    this.running = false;
    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
  }

  _animate(): void {
    if (!this.running) return;
    this.frameId = requestAnimationFrame(() => this._animate());

    const now = performance.now();
    const delta = (now - this.lastFrameTime) / 1000;
    this.lastFrameTime = now;

    this._updateCameraTargetAnimation(now);
    this.controls.update();

    if (!this._didDrag) {
      this._performPick(false);
    }

    this.connectionLines.updatePositions(this.resourceMeshes, this.clusterBounds);
    this.connectionLines.update(delta);
    this.particleTraffic.update(delta);
    this._animateResources(delta);
    this.renderer.render(this.scene, this.camera);
  }

  _updateCameraTargetAnimation(now: number): void {
    if (!this._cameraTargetAnimation) return;

    const animation = this._cameraTargetAnimation;
    const duration = Math.max(animation.duration, 1);
    const t = Math.min((now - animation.startTime) / duration, 1);
    const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

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

  _animateResources(delta: number): void {
    const time = performance.now() * 0.001;
    for (const group of this.resourceMeshes.values()) {
      const animate = (group.userData as ResourceUserData).animate;
      if (animate) {
        animate(time, delta);
      }
      this._updateLabelDetail(group);
    }
  }

  _updateLabelDetail(group: THREE.Group): void {
    const labels = (group.userData as ResourceUserData).labels;
    if (!labels) return;

    const zoomDistance = this.camera.position.distanceTo(this.controls.target);
    const nodeDistance = this.camera.position.distanceTo(group.position);
    const showFull = zoomDistance <= LABEL_FULL_DISTANCE;
    const showShort = !showFull && zoomDistance <= LABEL_SHORT_DISTANCE;

    labels.fullName.visible = showFull;
    labels.shortName.visible = showShort;
    if (labels.dataIn) labels.dataIn.visible = showFull;
    if (labels.dataOut) labels.dataOut.visible = showFull;

    const toCamera = new THREE.Vector3().subVectors(this.camera.position, group.position);
    const horizontal = new THREE.Vector3(toCamera.x, 0, toCamera.z).normalize();
    const forwardOffset = showFull ? 0.9 : showShort ? 0.72 : 0.58;
    this._setLabelPosition(labels.shortName, horizontal, forwardOffset);
    this._setLabelPosition(labels.fullName, horizontal, forwardOffset);
    if (labels.dataIn) this._setLabelPosition(labels.dataIn, horizontal, forwardOffset + 0.04);
    if (labels.dataOut) this._setLabelPosition(labels.dataOut, horizontal, forwardOffset + 0.04);

    if (showFull) {
      const factor = THREE.MathUtils.clamp(nodeDistance / 8, 1.35, 2.4);
      this._setLabelScale(labels.fullName, factor);
      if (labels.dataIn) this._setLabelScale(labels.dataIn, Math.max(1.15, factor * 0.92));
      if (labels.dataOut) this._setLabelScale(labels.dataOut, Math.max(1.15, factor * 0.92));
      this._setLabelScale(labels.shortName, 1);
      return;
    }

    if (showShort) {
      const factor = THREE.MathUtils.clamp(nodeDistance / 10, 1.25, 2.1);
      this._setLabelScale(labels.shortName, factor);
      this._setLabelScale(labels.fullName, 1);
      if (labels.dataIn) this._setLabelScale(labels.dataIn, 1);
      if (labels.dataOut) this._setLabelScale(labels.dataOut, 1);
      return;
    }

    this._setLabelScale(labels.shortName, 1);
    this._setLabelScale(labels.fullName, 1);
    if (labels.dataIn) this._setLabelScale(labels.dataIn, 1);
    if (labels.dataOut) this._setLabelScale(labels.dataOut, 1);
  }

  _setLabelScale(object: THREE.Object3D, factor: number): void {
    const originalScale = (object.userData as ResourceUserData).originalScale;
    if (!originalScale) return;
    object.scale.copy(originalScale).multiplyScalar(factor);
  }

  _setLabelPosition(object: THREE.Object3D, horizontal: THREE.Vector3, forwardOffset: number): void {
    const anchor = (object.userData as ResourceUserData).labelAnchor;
    if (!anchor) return;
    object.position.copy(anchor).addScaledVector(horizontal, forwardOffset);
  }

  flyTo(targetPosition: THREE.Vector3, cameraPosition: THREE.Vector3, duration = 1000): void {
    this._cameraTargetAnimation = {
      start: this.controls.target.clone(),
      end: targetPosition.clone(),
      startCamera: this.camera.position.clone(),
      endCamera: cameraPosition.clone(),
      startTime: performance.now(),
      duration,
    };
  }

  resetCamera(): void {
    this._cameraTargetAnimation = null;
    this.camera.position.copy(this._initialCameraPosition);
    this.controls.target.copy(this._initialCameraTarget);
    this.controls.update();
  }

  dispose(): void {
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
