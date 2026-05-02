import * as THREE from 'three';
import type { ClusterBounds, VisualizationConnection, VisualizationPathPoint } from '@/types/visualization';
import { MAX_CURVE_SEGMENTS, FLOWCHART_EDGE_Y } from './constants.js';
import { buildConnectionCurve } from './curveUtils.js';
import { createPillLabelTexture } from './labelUtils.js';

const RELATIONSHIP_COLORS = {
  ownership: 0x8b949e,
  network: 0x3b82f6,
  storage: 0x6b7280,
  config: 0xb45309,
  sync: 0x6366f1,
  async: 0x0f766e,
  signal: 0xca8a04,
  default: 0x64748b,
} as const;

const DASH_CONFIG = {
  ownership: { dashSize: 0.36, gapSize: 0.16 },
  network: { dashSize: 0.22, gapSize: 0.16 },
  storage: { dashSize: 0.42, gapSize: 0.16 },
  config: { dashSize: 0.18, gapSize: 0.14 },
  sync: { dashSize: 0.46, gapSize: 0.14 },
  async: { dashSize: 0.18, gapSize: 0.18 },
  signal: { dashSize: 0.12, gapSize: 0.12 },
  default: { dashSize: 0.3, gapSize: 0.15 },
} as const;

const FLOW_SPEEDS = {
  ownership: 0.26,
  network: 0.68,
  storage: 0.34,
  config: 0.34,
  sync: 0.46,
  async: 0.82,
  signal: 1.02,
  default: 0.42,
} as const;

const CURVE_SEGMENTS = MAX_CURVE_SEGMENTS;
const MIN_OPACITY = 0.56;
const MAX_OPACITY = 0.98;
const IDLE_FLOW_MULTIPLIER = 1.0;
const ACTIVE_FLOW_MULTIPLIER = 2.2;
const FLOWCHART_PATH_Y = FLOWCHART_EDGE_Y;
const UNDERLAY_Y_OFFSET = -0.004;
const UNDERLAY_OPACITY = 0.34;
const HIGHLIGHT_UNDERLAY_OPACITY = 0.5;
const HIGHLIGHT_UNDERLAY_Y_OFFSET = -0.007;

type LineMaterial = THREE.LineDashedMaterial;

interface ConnectionEntry {
  underlay: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  line: THREE.Line<THREE.BufferGeometry, LineMaterial>;
  connection: VisualizationConnection;
  curve: THREE.Curve<THREE.Vector3>;
  labelSprite: THREE.Sprite | null;
  sourcePos: THREE.Vector3;
  targetPos: THREE.Vector3;
}

interface LineUserData {
  connectionId?: string;
  sourceId?: string;
  targetId?: string;
  type?: string;
  flowOffset?: number;
  flowSpeed?: number;
  curve?: THREE.Curve<THREE.Vector3>;
}

interface DashedLineMaterial extends THREE.LineDashedMaterial {
  userData: {
    shader?: {
      uniforms: Record<string, { value: number }>;
    };
  };
}

export class ConnectionLineManager {
  scene: THREE.Scene;
  connections: Map<string, ConnectionEntry>;
  lineGroup: THREE.Group;
  labelTextures: Map<string, THREE.CanvasTexture>;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.connections = new Map();
    this.lineGroup = new THREE.Group();
    this.labelTextures = new Map();
    this.scene.add(this.lineGroup);
  }

  _getBaseOpacity(connection: VisualizationConnection): number {
    const trafficVolume = connection.trafficVolume || 1;
    return Math.min(MIN_OPACITY + trafficVolume * 0.06, MAX_OPACITY);
  }

  _getBaseFlowSpeed(connection: VisualizationConnection): number {
    const speed = FLOW_SPEEDS[connection.type as keyof typeof FLOW_SPEEDS] || FLOW_SPEEDS.default;
    return speed * IDLE_FLOW_MULTIPLIER;
  }

  _getActiveFlowSpeed(connection: VisualizationConnection): number {
    const speed = FLOW_SPEEDS[connection.type as keyof typeof FLOW_SPEEDS] || FLOW_SPEEDS.default;
    return speed * ACTIVE_FLOW_MULTIPLIER;
  }

  _isHighlightedType(connection: VisualizationConnection): boolean {
    return connection.type === 'signal' || connection.type === 'config';
  }

  addConnection(
    connection: VisualizationConnection,
    resourceMeshes: Map<string, THREE.Group>,
    clusterBounds?: Map<string, ClusterBounds>,
  ): void {
    if (this.connections.has(connection.id)) return;

    const [sourcePos, targetPos] = this._resolveConnectionEndpoints(connection, resourceMeshes, clusterBounds);
    if (!sourcePos || !targetPos) return;

    const curve = this._buildCurve(connection, sourcePos, targetPos);
    const midpoint = curve.getPoint(0.5);
    const relationColor = RELATIONSHIP_COLORS[connection.type as keyof typeof RELATIONSHIP_COLORS] || RELATIONSHIP_COLORS.default;
    const opacity = this._getBaseOpacity(connection);
    const dashConfig = DASH_CONFIG[connection.type as keyof typeof DASH_CONFIG] ?? DASH_CONFIG.default;
    const highlighted = this._isHighlightedType(connection);
    const material = new THREE.LineDashedMaterial({
      color: relationColor,
      dashSize: dashConfig.dashSize,
      gapSize: dashConfig.gapSize,
      transparent: true,
      opacity,
      depthWrite: false,
    });
    this._installDashOffsetAnimation(material);

    const sampledPoints = this._sampleCurve(curve);
    const geometry = new THREE.BufferGeometry().setFromPoints(sampledPoints);
    const underlay = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(sampledPoints.map((point) => point.clone().setY(
        point.y + (highlighted ? HIGHLIGHT_UNDERLAY_Y_OFFSET : UNDERLAY_Y_OFFSET),
      ))),
      new THREE.LineBasicMaterial({
        color: relationColor,
        transparent: true,
        opacity: highlighted ? HIGHLIGHT_UNDERLAY_OPACITY : UNDERLAY_OPACITY,
        depthWrite: false,
      }),
    );
    const line = new THREE.Line(geometry, material);
    underlay.renderOrder = 3;
    line.computeLineDistances();
    line.renderOrder = 4;

    const userData = line.userData as LineUserData;
    userData.connectionId = connection.id;
    userData.sourceId = connection.sourceId;
    userData.targetId = connection.targetId;
    userData.type = connection.type;
    userData.flowOffset = 0;
    userData.flowSpeed = this._getBaseFlowSpeed(connection);
    userData.curve = curve;

    const labelSprite = this._createLabelSprite(connection._label, midpoint);
    this.lineGroup.add(underlay);
    this.lineGroup.add(line);
    if (labelSprite) {
      this.lineGroup.add(labelSprite);
    }

    this.connections.set(connection.id, {
      underlay,
      line,
      connection,
      curve,
      labelSprite,
      sourcePos: sourcePos.clone(),
      targetPos: targetPos.clone(),
    });
  }

  removeConnection(connectionId: string): void {
    const entry = this.connections.get(connectionId);
    if (!entry) return;

    this.lineGroup.remove(entry.underlay);
    this.lineGroup.remove(entry.line);
    entry.underlay.geometry.dispose();
    entry.underlay.material.dispose();
    entry.line.geometry.dispose();
    entry.line.material.dispose();

    if (entry.labelSprite) {
      this.lineGroup.remove(entry.labelSprite);
      entry.labelSprite.material.dispose();
    }

    this.connections.delete(connectionId);
  }

  updatePositions(resourceMeshes: Map<string, THREE.Group>, clusterBounds?: Map<string, ClusterBounds>): void {
    for (const [id, entry] of this.connections) {
      const [sourcePos, targetPos] = this._resolveConnectionEndpoints(entry.connection, resourceMeshes, clusterBounds);
      if (!sourcePos || !targetPos) {
        this.removeConnection(id);
        continue;
      }

      if (
        sourcePos.distanceToSquared(entry.sourcePos) < 0.001
        && targetPos.distanceToSquared(entry.targetPos) < 0.001
      ) {
        continue;
      }

      entry.sourcePos.copy(sourcePos);
      entry.targetPos.copy(targetPos);

      const curve = this._buildCurve(entry.connection, sourcePos.clone(), targetPos.clone());
      entry.curve = curve;
      (entry.line.userData as LineUserData).curve = curve;

      const midpoint = curve.getPoint(0.5);
      if (entry.labelSprite) {
        entry.labelSprite.position.copy(midpoint);
        entry.labelSprite.position.y += 0.32;
      }

      const sampledPoints = this._sampleCurve(curve);
      const highlighted = this._isHighlightedType(entry.connection);
      entry.underlay.geometry.dispose();
      entry.underlay.geometry = new THREE.BufferGeometry().setFromPoints(
        sampledPoints.map((point) => point.clone().setY(
          point.y + (highlighted ? HIGHLIGHT_UNDERLAY_Y_OFFSET : UNDERLAY_Y_OFFSET),
        )),
      );
      entry.line.geometry.dispose();
      entry.line.geometry = new THREE.BufferGeometry().setFromPoints(sampledPoints);
      entry.line.computeLineDistances();
    }
  }

  update(delta: number): void {
    for (const entry of this.connections.values()) {
      const userData = entry.line.userData as LineUserData;
      userData.flowOffset = (userData.flowOffset || 0) + (userData.flowSpeed || 0) * delta;
      const shader = (entry.line.material as DashedLineMaterial).userData.shader;
      if (shader?.uniforms.dashOffset) {
        shader.uniforms.dashOffset.value = -(userData.flowOffset || 0);
      }
    }
  }

  setConnectionActive(connectionId: string, active: boolean): void {
    const entry = this.connections.get(connectionId);
    if (!entry) return;

    const baseUnderlayOpacity = this._isHighlightedType(entry.connection) ? HIGHLIGHT_UNDERLAY_OPACITY : UNDERLAY_OPACITY;
    entry.underlay.material.opacity = active ? Math.min(baseUnderlayOpacity + 0.12, 0.68) : baseUnderlayOpacity;
    entry.line.material.opacity = active ? MAX_OPACITY : this._getBaseOpacity(entry.connection);
    (entry.line.userData as LineUserData).flowSpeed = active
      ? this._getActiveFlowSpeed(entry.connection)
      : this._getBaseFlowSpeed(entry.connection);

    if (entry.labelSprite) {
      entry.labelSprite.material.opacity = active ? 1 : 0.88;
    }
  }

  private _sampleCurve(curve: THREE.Curve<THREE.Vector3>): THREE.Vector3[] {
    return curve.getPoints(CURVE_SEGMENTS);
  }

  private _createLabelSprite(text: string | null | undefined, midpoint: THREE.Vector3): THREE.Sprite | null {
    const texture = this._getLabelTexture(text);
    if (!texture) return null;

    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      opacity: 0.88,
      sizeAttenuation: true,
    }));
    sprite.renderOrder = 8;
    sprite.position.copy(midpoint);
    sprite.position.y += 0.4;
    sprite.scale.set(2.6, 0.42, 1);
    return sprite;
  }

  private _getLabelTexture(text: string | null | undefined): THREE.CanvasTexture | null {
    const label = text?.trim() || '';
    if (!label) return null;
    if (this.labelTextures.has(label)) {
      return this.labelTextures.get(label) || null;
    }

    const texture = createPillLabelTexture(label);
    this.labelTextures.set(label, texture);
    return texture;
  }

  private _installDashOffsetAnimation(material: THREE.LineDashedMaterial): void {
    const dashedMaterial = material as DashedLineMaterial;
    dashedMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.dashOffset = { value: 0 };
      shader.fragmentShader = shader.fragmentShader.replace(
        'uniform float dashSize;\nuniform float totalSize;',
        'uniform float dashSize;\nuniform float totalSize;\nuniform float dashOffset;',
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        'if ( mod( vLineDistance, totalSize ) > dashSize ) {',
        'if ( mod( vLineDistance + dashOffset, totalSize ) > dashSize ) {',
      );
      dashedMaterial.userData.shader = shader as DashedLineMaterial['userData']['shader'];
    };
    dashedMaterial.needsUpdate = true;
  }

  private _buildCurve(
    connection: VisualizationConnection,
    sourcePos: THREE.Vector3,
    targetPos: THREE.Vector3,
  ): THREE.Curve<THREE.Vector3> {
    return buildConnectionCurve(sourcePos, targetPos, connection.pathPoints);
  }

  private _resolveEndpointPosition(
    endpointId: string,
    endpointKind: VisualizationConnection['sourceKind'],
    resourceMeshes: Map<string, THREE.Group>,
    clusterBounds?: Map<string, ClusterBounds>,
    oppositePos?: THREE.Vector3,
  ): THREE.Vector3 | null {
    if (endpointKind !== 'subgraph') {
      const group = resourceMeshes.get(endpointId);
      return group ? group.position.clone() : null;
    }

    const bounds = clusterBounds?.get(endpointId);
    if (!bounds) return null;

    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerZ = (bounds.minZ + bounds.maxZ) / 2;
    if (!oppositePos) {
      return new THREE.Vector3(centerX, 0.62, centerZ);
    }

    const dx = oppositePos.x - centerX;
    const dz = oppositePos.z - centerZ;
    const halfW = Math.max((bounds.maxX - bounds.minX) / 2, 0.001);
    const halfD = Math.max((bounds.maxZ - bounds.minZ) / 2, 0.001);
    const sx = Math.abs(dx) > 0.0001 ? halfW / Math.abs(dx) : Number.POSITIVE_INFINITY;
    const sz = Math.abs(dz) > 0.0001 ? halfD / Math.abs(dz) : Number.POSITIVE_INFINITY;
    const scale = Math.min(sx, sz);
    const inset = 0.12;

    return new THREE.Vector3(
      centerX + dx * Math.max(scale - inset, 0),
      0.62,
      centerZ + dz * Math.max(scale - inset, 0),
    );
  }

  private _resolveConnectionEndpoints(
    connection: VisualizationConnection,
    resourceMeshes: Map<string, THREE.Group>,
    clusterBounds?: Map<string, ClusterBounds>,
  ): [THREE.Vector3 | null, THREE.Vector3 | null] {
    const sourceCenter = this._resolveEndpointPosition(
      connection.sourceId,
      connection.sourceKind,
      resourceMeshes,
      clusterBounds,
    );
    const targetCenter = this._resolveEndpointPosition(
      connection.targetId,
      connection.targetKind,
      resourceMeshes,
      clusterBounds,
    );
    if (!sourceCenter || !targetCenter) return [null, null];

    const sourcePos = this._resolveEndpointPosition(
      connection.sourceId,
      connection.sourceKind,
      resourceMeshes,
      clusterBounds,
      targetCenter,
    );
    const targetPos = this._resolveEndpointPosition(
      connection.targetId,
      connection.targetKind,
      resourceMeshes,
      clusterBounds,
      sourceCenter,
    );

    return [sourcePos, targetPos];
  }

  dispose(): void {
    for (const id of [...this.connections.keys()]) {
      this.removeConnection(id);
    }
    for (const texture of this.labelTextures.values()) {
      texture.dispose();
    }
    this.labelTextures.clear();
    this.scene.remove(this.lineGroup);
  }
}
