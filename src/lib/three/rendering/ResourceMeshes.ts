import * as THREE from 'three';
import type { VisualizationNode, VisualizationResourceStatus } from '@/types/visualization';
import {
  DEFAULT_NODE_WIDTH,
  DEFAULT_NODE_HEIGHT,
  DEFAULT_NODE_DEPTH,
  DEFAULT_HALF_HEIGHT,
  DEFAULT_NODE_COLOR,
  DEFAULT_EMISSIVE_INTENSITY,
  EDGE_LINE_COLOR,
} from './constants.js';
import { disposeObject3D } from './threeUtils.js';
import { normalizeLabelText } from './labelUtils.js';

const STATUS_COLORS = {
  idle: 0x94a3b8,
  active: 0x94a3b8,
  complete: 0x3b82f6,
  error: 0xef4444,
  default: 0x94a3b8,
} as const;

const BASE_COLOR = DEFAULT_NODE_COLOR;
const TEXT_COLOR = '#1e293b';
const LABEL_SURFACE_OFFSET = 0.08;
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
  return normalizeLabelText(text);
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
  ctx.font = `700 ${fontSize}px ${fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const lineHeight = Math.round(fontSize * 1.02);
  ctx.fillStyle = TEXT_COLOR;
  ctx.shadowColor = 'rgba(255, 255, 255, 0.18)';
  ctx.shadowBlur = 2;
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
      depthTest: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -4,
      side: THREE.DoubleSide,
    }),
  );
  const userData = plane.userData as MeshUserData;
  userData.isLabel = true;
  plane.renderOrder = 6;
  return plane;
}

function createBodyMaterial(nodeColor: number, statusColor: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: nodeColor,
    metalness: 0,
    roughness: 0.92,
    emissive: new THREE.Color(statusColor),
    emissiveIntensity: DEFAULT_EMISSIVE_INTENSITY,
  });
}

function createEdgeLines(geometry: THREE.BufferGeometry): THREE.LineSegments {
  const edgeGeometry = new THREE.EdgesGeometry(geometry);
  const edgeMaterial = new THREE.LineBasicMaterial({
    color: EDGE_LINE_COLOR,
    transparent: true,
    opacity: 0.38,
  });
  return new THREE.LineSegments(edgeGeometry, edgeMaterial);
}

function addBoxLabels(group: ResourceGroup, resource: VisualizationNode, width: number, height: number, depth: number): void {
  const labelText = resource.fullLabel || resource.name || resource.id || 'Node';

  const topLabel = createLabelPlane(labelText, {
    fontSize: 88,
    width: 1600,
    height: 420,
    maxTextWidth: 1590,
    scale: { x: width * 0.995, y: depth * 0.97, z: 1 },
  });
  topLabel.rotation.x = -Math.PI / 2;
  topLabel.position.set(0, height / 2 + LABEL_SURFACE_OFFSET, 0);
  group.add(topLabel);

  const frontLabel = createLabelPlane(labelText, {
    fontSize: 92,
    width: 1600,
    height: 540,
    maxTextWidth: 1590,
    scale: { x: width * 0.995, y: height * 0.97, z: 1 },
  });
  frontLabel.position.set(0, 0, depth / 2 + LABEL_SURFACE_OFFSET);
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
  const width = resource.renderWidth ?? DEFAULT_NODE_WIDTH;
  const height = resource.renderHeight ?? DEFAULT_NODE_HEIGHT;
  const depth = resource.renderDepth ?? DEFAULT_NODE_DEPTH;

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
    (group.userData as MeshUserData).halfHeight = (resource.renderHeight ?? DEFAULT_NODE_HEIGHT) / 2;
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
    disposeObject3D(group);
  }
}
