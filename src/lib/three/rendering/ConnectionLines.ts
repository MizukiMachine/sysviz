import * as THREE from 'three';
import type { ClusterBounds, VisualizationConnection } from '@/types/visualization';

const RELATIONSHIP_COLORS = {
  ownership: 0x8b949e,
  network: 0x3b82f6,
  storage: 0x6b7280,
  config: 0xd97706,
  sync: 0x6366f1,
  async: 0x0891b2,
  signal: 0xa16207,
  default: 0x64748b,
} as const;

const DASH_CONFIG = {
  network: { dashSize: 0.3, gapSize: 0.15 },
  sync: { dashSize: 0.6, gapSize: 0.08 },
  async: { dashSize: 0.35, gapSize: 0.15 },
  signal: { dashSize: 0.35, gapSize: 0.1 },
  default: { dashSize: 0.3, gapSize: 0.15 },
} as const;

const FLOW_SPEEDS = {
  network: 2.0,
  sync: 2.5,
  async: 1.0,
  signal: 3.5,
  default: 2.0,
} as const;

const CURVE_SEGMENTS = 32;
const BASE_LINE_WIDTH = 1.5;
const MIN_OPACITY = 0.55;
const MAX_OPACITY = 1.0;
const IDLE_FLOW_MULTIPLIER = 0.4;
const ACTIVE_FLOW_MULTIPLIER = 1.8;
const ARROW_HEAD_LENGTH = 0.46;
const ARROW_HEAD_RADIUS = 0.16;
const ARROW_HEAD_OPACITY = 0.9;
const ARROW_HEAD_T = 0.8;
const ARROW_HEAD_Y_OFFSET = 0.08;

type LineMaterial = THREE.LineBasicMaterial | THREE.LineDashedMaterial;

interface ConnectionEntry {
  line: THREE.Line<THREE.BufferGeometry, LineMaterial>;
  arrowHead: THREE.Mesh<THREE.ConeGeometry, THREE.MeshBasicMaterial>;
  connection: VisualizationConnection;
  curve: THREE.QuadraticBezierCurve3;
  labelSprite: THREE.Sprite | null;
  sourcePos: THREE.Vector3;
  targetPos: THREE.Vector3;
  midpoint: THREE.Vector3;
}

interface LineUserData {
  connectionId?: string;
  sourceId?: string;
  targetId?: string;
  type?: string;
  flowOffset?: number;
  flowSpeed?: number;
  curve?: THREE.QuadraticBezierCurve3;
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

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.connections = new Map();
    this.lineGroup = new THREE.Group();
    this.scene.add(this.lineGroup);
  }

  _getBaseOpacity(connection: VisualizationConnection): number {
    const trafficVolume = connection.trafficVolume || 1;
    return Math.min(MIN_OPACITY + trafficVolume * 0.05, MAX_OPACITY);
  }

  _getBaseFlowSpeed(connection: VisualizationConnection): number {
    const speed = FLOW_SPEEDS[connection.type as keyof typeof FLOW_SPEEDS] || FLOW_SPEEDS.default;
    return speed * IDLE_FLOW_MULTIPLIER;
  }

  _getActiveFlowSpeed(connection: VisualizationConnection): number {
    const speed = FLOW_SPEEDS[connection.type as keyof typeof FLOW_SPEEDS] || FLOW_SPEEDS.default;
    return speed * ACTIVE_FLOW_MULTIPLIER;
  }

  addConnection(
    connection: VisualizationConnection,
    resourceMeshes: Map<string, THREE.Group>,
    clusterBounds?: Map<string, ClusterBounds>,
  ): void {
    if (this.connections.has(connection.id)) return;

    const [sourcePos, targetPos] = this._resolveConnectionEndpoints(connection, resourceMeshes, clusterBounds);
    if (!sourcePos || !targetPos) return;

    const midpoint = new THREE.Vector3().lerpVectors(sourcePos, targetPos, 0.5);
    const distance = sourcePos.distanceTo(targetPos);
    midpoint.y += Math.min(distance * 0.3, 3);

    const curve = new THREE.QuadraticBezierCurve3(sourcePos, midpoint, targetPos);
    const points = curve.getPoints(CURVE_SEGMENTS);
    const geometry = new THREE.BufferGeometry().setFromPoints(points);

    const relationColor = RELATIONSHIP_COLORS[connection.type as keyof typeof RELATIONSHIP_COLORS] || RELATIONSHIP_COLORS.default;
    const opacity = this._getBaseOpacity(connection);
    const dashConfig = DASH_CONFIG[connection.type as keyof typeof DASH_CONFIG] ?? DASH_CONFIG.default;

    const material = new THREE.LineDashedMaterial({
      color: relationColor,
      dashSize: dashConfig?.dashSize ?? 0.3,
      gapSize: dashConfig?.gapSize ?? 0.15,
      transparent: true,
      opacity,
      linewidth: BASE_LINE_WIDTH,
    });
    this._installDashOffsetAnimation(material);

    const line = new THREE.Line(geometry, material);
    line.computeLineDistances();
    const userData = line.userData as LineUserData;
    userData.connectionId = connection.id;
    userData.sourceId = connection.sourceId;
    userData.targetId = connection.targetId;
    userData.type = connection.type;
    userData.flowOffset = 0;
    userData.flowSpeed = this._getBaseFlowSpeed(connection);
    userData.curve = curve;

    const arrowHead = this._createArrowHead(relationColor);
    this._updateArrowHead(arrowHead, curve);

    this.lineGroup.add(line);
    this.lineGroup.add(arrowHead);

    this.connections.set(connection.id, {
      line,
      arrowHead,
      connection,
      curve,
      labelSprite: null,
      sourcePos: sourcePos.clone(),
      targetPos: targetPos.clone(),
      midpoint: midpoint.clone(),
    });
  }

  removeConnection(connectionId: string): void {
    const entry = this.connections.get(connectionId);
    if (!entry) return;

    this.lineGroup.remove(entry.line);
    this.lineGroup.remove(entry.arrowHead);
    entry.line.geometry.dispose();
    entry.line.material.dispose();
    entry.arrowHead.geometry.dispose();
    entry.arrowHead.material.dispose();

    if (entry.labelSprite) {
      this.lineGroup.remove(entry.labelSprite);
      entry.labelSprite.material.map?.dispose();
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

      const midpoint = new THREE.Vector3().lerpVectors(sourcePos, targetPos, 0.5);
      const distance = sourcePos.distanceTo(targetPos);
      midpoint.y += Math.min(distance * 0.3, 3);
      entry.midpoint.copy(midpoint);

      if (entry.labelSprite) {
        entry.labelSprite.position.copy(midpoint);
        entry.labelSprite.position.y += 0.4;
      }

      const curve = new THREE.QuadraticBezierCurve3(sourcePos.clone(), midpoint, targetPos.clone());
      entry.curve = curve;
      (entry.line.userData as LineUserData).curve = curve;
      this._updateArrowHead(entry.arrowHead, curve);

      const points = curve.getPoints(CURVE_SEGMENTS);
      entry.line.geometry.dispose();
      entry.line.geometry = new THREE.BufferGeometry().setFromPoints(points);
      entry.line.computeLineDistances();
    }
  }

  update(delta: number): void {
    for (const entry of this.connections.values()) {
      const line = entry.line;
      const userData = line.userData as LineUserData;
      userData.flowOffset = (userData.flowOffset || 0) + (userData.flowSpeed || 0) * delta;
      const shader = (line.material as DashedLineMaterial).userData.shader;
      if (shader?.uniforms.dashOffset) {
        shader.uniforms.dashOffset.value = -(userData.flowOffset || 0);
      }
    }
  }

  setConnectionActive(connectionId: string, active: boolean): void {
    const entry = this.connections.get(connectionId);
    if (!entry) return;

    entry.line.material.opacity = active ? MAX_OPACITY : this._getBaseOpacity(entry.connection);
    entry.arrowHead.material.opacity = active ? 0.98 : ARROW_HEAD_OPACITY;
    (entry.line.userData as LineUserData).flowSpeed = active
      ? this._getActiveFlowSpeed(entry.connection)
      : this._getBaseFlowSpeed(entry.connection);
  }

  private _createArrowHead(color: number): THREE.Mesh<THREE.ConeGeometry, THREE.MeshBasicMaterial> {
    const geometry = new THREE.ConeGeometry(ARROW_HEAD_RADIUS, ARROW_HEAD_LENGTH, 10);
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: ARROW_HEAD_OPACITY,
      depthWrite: false,
      depthTest: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = 6;
    return mesh;
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

  private _updateArrowHead(
    arrowHead: THREE.Mesh<THREE.ConeGeometry, THREE.MeshBasicMaterial>,
    curve: THREE.QuadraticBezierCurve3,
  ): void {
    const t = ARROW_HEAD_T;
    const point = curve.getPoint(t);
    const tangent = curve.getTangent(t).normalize();
    if (tangent.lengthSq() < 0.0001) return;

    arrowHead.position.copy(point);
    arrowHead.position.y += ARROW_HEAD_Y_OFFSET;
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
    arrowHead.quaternion.copy(quat);
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
      return new THREE.Vector3(centerX, 0.05, centerZ);
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
      0.05,
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
    this.scene.remove(this.lineGroup);
  }
}
