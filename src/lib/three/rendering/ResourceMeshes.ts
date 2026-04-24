import * as THREE from 'three';
import type { VisualizationNode, VisualizationResourceStatus } from '@/types/visualization';

const STATUS_COLORS = {
  idle: 0x94a3b8,
  active: 0x94a3b8,
  complete: 0x3b82f6,
  error: 0xef4444,
  default: 0x94a3b8,
} as const;

const BASE_COLOR = 0xe2e8f0;
const TEXT_COLOR = '#f8fafc';
const LABEL_BG = 'rgba(15, 23, 42, 0.82)';
const LABEL_STROKE = 'rgba(226, 232, 240, 0.45)';
const _labelTextureCache = new Map<string, THREE.CanvasTexture>();

interface LabelSpriteOptions {
  fontSize?: number;
  width?: number;
  height?: number;
  maxTextWidth?: number;
  scale?: { x: number; y: number; z: number };
  fontFamily?: string;
}

interface MeshUserData {
  isLabel?: boolean;
  baseY?: number;
  animate?: (time: number, delta?: number) => void;
  isScaled?: boolean;
  halfHeight?: number;
  labelVariant?: 'short' | 'full' | 'data';
}

interface ResourceLabelSet {
  shortName: THREE.Object3D;
  fullName: THREE.Object3D;
  dataIn?: THREE.Object3D;
  dataOut?: THREE.Object3D;
}

interface LabelTextureOptions {
  fontSize?: number;
  width?: number;
  height?: number;
  maxTextWidth?: number;
  fontFamily?: string;
}

interface LabelPlaneOptions extends LabelTextureOptions {
  scale?: { x: number; y: number; z: number };
}

type ResourceGroup = THREE.Group;
type ResourceCreator = (resource: VisualizationNode) => ResourceGroup;

function shortenLabel(resource: VisualizationNode): string {
  const preferred = (resource.id || '').trim();
  if (preferred && preferred.length <= 14) return preferred;

  const name = (resource.name || resource.id || 'Node').trim();
  if (name.length <= 14) return name;

  const words = name
    .split(/[\s/_-]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (words.length >= 2) {
    const initials = words.map((part) => part[0]?.toUpperCase() ?? '').join('');
    if (initials.length >= 2 && initials.length <= 8) return initials;
  }

  return `${name.slice(0, 11).trimEnd()}…`;
}

function getStatusColor(status: VisualizationResourceStatus | undefined): number {
  if (!status) return STATUS_COLORS.default;
  return STATUS_COLORS[String(status).toLowerCase() as keyof typeof STATUS_COLORS] || STATUS_COLORS.default;
}

function roundedBoxGeometry(width: number, height: number, depth: number, radius: number): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  const hw = width / 2 - radius;
  const hh = height / 2 - radius;

  shape.moveTo(-hw, height / 2);
  shape.lineTo(hw, height / 2);
  shape.quadraticCurveTo(width / 2, height / 2, width / 2, hh);
  shape.lineTo(width / 2, -hh);
  shape.quadraticCurveTo(width / 2, -height / 2, hw, -height / 2);
  shape.lineTo(-hw, -height / 2);
  shape.quadraticCurveTo(-width / 2, -height / 2, -width / 2, -hh);
  shape.lineTo(-width / 2, hh);
  shape.quadraticCurveTo(-width / 2, height / 2, -hw, height / 2);

  return new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.05,
    bevelSegments: 2,
  });
}

export function createLabelSprite(text: string, options: LabelSpriteOptions = {}): THREE.Sprite {
  const {
    fontSize = 36,
    width = 768,
    height = 128,
    maxTextWidth = width - 32,
    scale = { x: 4.4, y: 0.78, z: 1 },
    fontFamily = '"Inter", sans-serif',
  } = options;
  const texture = getLabelTexture(text, { fontSize, width, height, maxTextWidth, fontFamily });

  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    sizeAttenuation: true,
  }));
  sprite.scale.set(scale.x, scale.y, scale.z);
  (sprite.userData as MeshUserData).isLabel = true;
  return sprite;
}

function getLabelTexture(text: string, options: LabelTextureOptions = {}): THREE.CanvasTexture {
  const {
    fontSize = 36,
    width = 768,
    height = 128,
    maxTextWidth = width - 32,
    fontFamily = '"Inter", sans-serif',
  } = options;
  const cacheKey = JSON.stringify({ text, fontSize, width, height, maxTextWidth, fontFamily });

  let texture = _labelTextureCache.get(cacheKey);
  if (texture) return texture;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

  ctx.clearRect(0, 0, width, height);
  ctx.font = `600 ${fontSize}px ${fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const metrics = ctx.measureText(text);
  const textWidth = Math.min(metrics.width + 32, width - 12);
  const boxHeight = Math.min(height - 16, fontSize + 22);
  const boxX = (width - textWidth) / 2;
  const boxY = (height - boxHeight) / 2;
  const radius = 12;

  ctx.fillStyle = LABEL_BG;
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

  ctx.strokeStyle = LABEL_STROKE;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = TEXT_COLOR;
  ctx.shadowColor = 'rgba(15, 23, 42, 0.45)';
  ctx.shadowBlur = 10;
  ctx.fillText(text, width / 2, height / 2, maxTextWidth);
  ctx.shadowBlur = 0;

  texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  _labelTextureCache.set(cacheKey, texture);
  return texture;
}

function createLabelPlane(text: string, options: LabelPlaneOptions = {}): THREE.Mesh {
  const {
    fontSize = 36,
    width = 768,
    height = 128,
    maxTextWidth = width - 32,
    scale = { x: 2.15, y: 0.54, z: 1 },
    fontFamily = '"Inter", sans-serif',
  } = options;

  const texture = getLabelTexture(text, { fontSize, width, height, maxTextWidth, fontFamily });
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(scale.x, scale.y),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0.96,
      depthTest: false,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      side: THREE.DoubleSide,
    }),
  );
  const userData = plane.userData as MeshUserData;
  userData.isLabel = true;
  plane.renderOrder = 6;
  return plane;
}

function createBodyMaterial(nodeColor: number, statusColor: number): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: nodeColor,
    metalness: 0.15,
    roughness: 0.28,
    emissive: new THREE.Color(statusColor),
    emissiveIntensity: 0.12,
    transparent: true,
    opacity: 0.82,
    transmission: 0.04,
    clearcoat: 0.28,
    clearcoatRoughness: 0.3,
  });
}

function createEdgeLines(geometry: THREE.BufferGeometry): THREE.LineSegments {
  const edgeGeometry = new THREE.EdgesGeometry(geometry);
  const edgeMaterial = new THREE.LineBasicMaterial({
    color: 0x64748b,
    transparent: true,
    opacity: 0.38,
  });
  return new THREE.LineSegments(edgeGeometry, edgeMaterial);
}

function addResourceElements(
  group: ResourceGroup,
  resource: VisualizationNode,
  _statusColor: number,
  layout: {
    nameY: number;
    nameZ: number;
    nameScale: { x: number; y: number; z: number };
    dataInY: number;
    dataOutY: number;
    dataZ: number;
    dataScale: { x: number; y: number; z: number };
  },
): void {
  const shortNameLabel = createLabelSprite(shortenLabel(resource), {
    fontSize: 38,
    width: 768,
    height: 156,
    scale: { x: layout.nameScale.x * 1.18, y: layout.nameScale.y * 1.15, z: 1 },
  });
  (shortNameLabel.userData as MeshUserData).labelVariant = 'short';
  shortNameLabel.position.set(0, layout.nameY, layout.nameZ);
  group.add(shortNameLabel);

  const fullNameLabel = createLabelSprite(resource.name || resource.id || 'Node', {
    fontSize: 42,
    width: 1024,
    height: 192,
    scale: { x: layout.nameScale.x * 1.42, y: layout.nameScale.y * 1.28, z: 1 },
  });
  (fullNameLabel.userData as MeshUserData).labelVariant = 'full';
  fullNameLabel.position.set(0, layout.nameY, layout.nameZ);
  group.add(fullNameLabel);

  const labels: ResourceLabelSet = {
    shortName: shortNameLabel,
    fullName: fullNameLabel,
  };

  if (resource.dataIn) {
    const dataInLabel = createLabelSprite(`IN: ${resource.dataIn}`, {
      fontSize: 20,
      width: 1024,
      height: 128,
      scale: { x: layout.dataScale.x * 1.22, y: layout.dataScale.y * 1.18, z: 1 },
    });
    (dataInLabel.userData as MeshUserData).labelVariant = 'data';
    dataInLabel.position.set(0, layout.dataInY, layout.dataZ);
    group.add(dataInLabel);
    labels.dataIn = dataInLabel;
  }

  if (resource.dataOut) {
    const dataOutLabel = createLabelSprite(`OUT: ${resource.dataOut}`, {
      fontSize: 20,
      width: 1024,
      height: 128,
      scale: { x: layout.dataScale.x * 1.22, y: layout.dataScale.y * 1.18, z: 1 },
    });
    (dataOutLabel.userData as MeshUserData).labelVariant = 'data';
    dataOutLabel.position.set(0, layout.dataOutY, layout.dataZ);
    group.add(dataOutLabel);
    labels.dataOut = dataOutLabel;
  }

  group.userData.labels = labels;

  const idleY = resource.y || 0;
  const userData = group.userData as MeshUserData;
  userData.baseY = idleY;
  userData.animate = resource.animate || ((time: number) => {
    void time;
  });
}

function createDefaultResource(resource: VisualizationNode): ResourceGroup {
  const group = new THREE.Group();
  const statusColor = getStatusColor(resource.status);
  const nodeColor = resource.color || BASE_COLOR;

  const geometry = roundedBoxGeometry(2.8, 1.3, 0.6, 0.18);
  geometry.center();
  const body = new THREE.Mesh(geometry, createBodyMaterial(nodeColor, statusColor));
  group.add(body);
  group.add(createEdgeLines(geometry));

  addResourceElements(group, resource, statusColor, {
    nameY: 1.24,
    nameZ: 0.02,
    nameScale: { x: 2.7, y: 0.72, z: 1 },
    dataInY: 0.42,
    dataOutY: -0.08,
    dataZ: 0.04,
    dataScale: { x: 3.0, y: 0.4, z: 1 },
  });
  return group;
}

function createSphereResource(resource: VisualizationNode): ResourceGroup {
  const group = new THREE.Group();
  const statusColor = getStatusColor(resource.status);
  const nodeColor = resource.color || BASE_COLOR;

  const geometry = new THREE.IcosahedronGeometry(1.0, 2);
  const body = new THREE.Mesh(geometry, createBodyMaterial(nodeColor, statusColor));
  group.add(body);
  group.add(createEdgeLines(geometry));

  addResourceElements(group, resource, statusColor, {
    nameY: 1.45,
    nameZ: 0.04,
    nameScale: { x: 2.0, y: 0.56, z: 1 },
    dataInY: 0.54,
    dataOutY: 0.16,
    dataZ: 0.04,
    dataScale: { x: 2.25, y: 0.34, z: 1 },
  });
  return group;
}

function createCylinderResource(resource: VisualizationNode): ResourceGroup {
  const group = new THREE.Group();
  const statusColor = getStatusColor(resource.status);
  const nodeColor = resource.color || BASE_COLOR;

  const geometry = new THREE.CylinderGeometry(0.9, 0.9, 1.4, 32);
  const body = new THREE.Mesh(geometry, createBodyMaterial(nodeColor, statusColor));
  group.add(body);
  group.add(createEdgeLines(geometry));

  addResourceElements(group, resource, statusColor, {
    nameY: 1.32,
    nameZ: 0.04,
    nameScale: { x: 2.15, y: 0.56, z: 1 },
    dataInY: 0.42,
    dataOutY: 0.04,
    dataZ: 0.04,
    dataScale: { x: 2.5, y: 0.34, z: 1 },
  });
  return group;
}

function createDiamondResource(resource: VisualizationNode): ResourceGroup {
  const group = new THREE.Group();
  const statusColor = getStatusColor(resource.status);
  const nodeColor = resource.color || BASE_COLOR;

  const geometry = new THREE.OctahedronGeometry(1.0, 0);
  const body = new THREE.Mesh(geometry, createBodyMaterial(nodeColor, statusColor));
  group.add(body);
  group.add(createEdgeLines(geometry));

  addResourceElements(group, resource, statusColor, {
    nameY: 1.42,
    nameZ: 0.04,
    nameScale: { x: 2.0, y: 0.56, z: 1 },
    dataInY: 0.5,
    dataOutY: 0.12,
    dataZ: 0.04,
    dataScale: { x: 2.2, y: 0.34, z: 1 },
  });
  return group;
}

function createTorusResource(resource: VisualizationNode): ResourceGroup {
  const group = new THREE.Group();
  const statusColor = getStatusColor(resource.status);
  const nodeColor = resource.color || BASE_COLOR;

  const geometry = new THREE.TorusGeometry(0.7, 0.3, 16, 48);
  const body = new THREE.Mesh(geometry, createBodyMaterial(nodeColor, statusColor));
  group.add(body);
  group.add(createEdgeLines(geometry));

  addResourceElements(group, resource, statusColor, {
    nameY: 1.36,
    nameZ: 0.04,
    nameScale: { x: 2.05, y: 0.56, z: 1 },
    dataInY: 0.48,
    dataOutY: 0.12,
    dataZ: 0.04,
    dataScale: { x: 2.25, y: 0.34, z: 1 },
  });
  return group;
}

const CREATORS: Record<string, ResourceCreator> = {
  default: createDefaultResource,
  sphere: createSphereResource,
  cylinder: createCylinderResource,
  diamond: createDiamondResource,
  torus: createTorusResource,
};

const HALF_HEIGHTS: Record<string, number> = {
  default: 0.65,
  sphere: 1.0,
  cylinder: 0.7,
  diamond: 1.0,
  torus: 1.0,
};

export class ResourceMeshFactory {
  create(resource: VisualizationNode): ResourceGroup {
    const shape = resource.shape || 'default';
    const creator = CREATORS[shape] || CREATORS.default;
    const group = creator(resource);
    (group.userData as MeshUserData).halfHeight = HALF_HEIGHTS[shape] || HALF_HEIGHTS.default;
    return group;
  }

  updateStatus(group: ResourceGroup, status: VisualizationResourceStatus): void {
    const statusColor = getStatusColor(status);

    group.traverse((child) => {
      const object = child as THREE.Object3D & {
        material?: THREE.Material;
        isMesh?: boolean;
        userData: MeshUserData;
      };
      const material = object.material as (THREE.Material & {
        emissive?: THREE.Color;
        emissiveIntensity?: number;
      }) | undefined;

      if (!material) return;
      if (object.isMesh && !object.userData.isLabel && material.emissive) {
        material.emissive.set(statusColor);
        material.emissiveIntensity = 0.14;
      }
    });

    // -- Active decoration extension point --
    // Add/remove visual indicators for the active node here.
    // Example: ring, glow, outline, particles above the node, etc.
    // const isActive = String(status).toLowerCase() === 'active';
  }

  dispose(group: ResourceGroup | null | undefined): void {
    if (!group) return;
    group.traverse((child) => {
      const object = child as THREE.Object3D & {
        geometry?: { dispose: () => void };
        material?: THREE.Material | THREE.Material[];
      };
      object.geometry?.dispose();
      if (!object.material) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        (material as THREE.Material & { map?: THREE.Texture | null }).map?.dispose();
        material.dispose();
      }
    });
  }
}
