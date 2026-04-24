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
const TEXT_COLOR = '#334155';
const LABEL_BG = 'rgba(255, 255, 255, 0.72)';
const LABEL_STROKE = 'rgba(148, 163, 184, 0.32)';
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
  labelAnchor?: THREE.Vector3;
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

function getLabelLines(text: string): string[] {
  const normalized = text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .trim();
  return normalized.split('\n').map((line) => line.trim()).filter(Boolean);
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
  const lines = getLabelLines(text);
  const safeLines = lines.length > 0 ? lines : [''];

  ctx.clearRect(0, 0, width, height);
  ctx.font = `600 ${fontSize}px ${fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const metrics = safeLines.map((line) => ctx.measureText(line).width);
  const textWidth = Math.min(Math.max(...metrics, 0) + 40, width - 12);
  const lineHeight = Math.round(fontSize * 1.15);
  const contentHeight = Math.max(lineHeight * safeLines.length, fontSize + 22);
  const boxHeight = Math.min(height - 16, contentHeight + 20);
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
  ctx.shadowColor = 'rgba(255, 255, 255, 0.7)';
  ctx.shadowBlur = 6;
  const startY = height / 2 - ((safeLines.length - 1) * lineHeight) / 2;
  for (const [index, line] of safeLines.entries()) {
    ctx.fillText(line, width / 2, startY + index * lineHeight, maxTextWidth);
  }
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

function addBoxLabels(group: ResourceGroup, resource: VisualizationNode, width: number, height: number, depth: number): void {
  const labelText = resource.fullLabel || resource.name || resource.id || 'Node';

  const topLabel = createLabelPlane(labelText, {
    fontSize: 42,
    width: 1200,
    height: 256,
    maxTextWidth: 1120,
    scale: { x: width * 0.92, y: depth * 0.74, z: 1 },
  });
  topLabel.rotation.x = -Math.PI / 2;
  topLabel.position.set(0, height / 2 + 0.04, 0);
  group.add(topLabel);

  const frontLabel = createLabelPlane(labelText, {
    fontSize: 38,
    width: 1200,
    height: 320,
    maxTextWidth: 1120,
    scale: { x: width * 0.92, y: height * 0.8, z: 1 },
  });
  frontLabel.position.set(0, 0, depth / 2 + 0.04);
  group.add(frontLabel);

  const idleY = resource.y || 0;
  const userData = group.userData as MeshUserData;
  userData.baseY = idleY;
  userData.animate = resource.animate || ((time: number) => {
    void time;
  });
}

function createBoxResource(resource: VisualizationNode): ResourceGroup {
  const group = new THREE.Group();
  const statusColor = getStatusColor(resource.status);
  const nodeColor = resource.color || BASE_COLOR;
  const width = resource.renderWidth ?? 2.8;
  const height = resource.renderHeight ?? 1.3;
  const depth = resource.renderDepth ?? 0.85;

  const geometry = roundedBoxGeometry(width, height, depth, 0.18);
  geometry.center();
  const body = new THREE.Mesh(geometry, createBodyMaterial(nodeColor, statusColor));
  group.add(body);
  group.add(createEdgeLines(geometry));
  addBoxLabels(group, resource, width, height, depth);
  return group;
}

export class ResourceMeshFactory {
  create(resource: VisualizationNode): ResourceGroup {
    const group = createBoxResource(resource);
    (group.userData as MeshUserData).halfHeight = (resource.renderHeight ?? 1.3) / 2;
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
