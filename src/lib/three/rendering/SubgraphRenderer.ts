import * as THREE from 'three';
import type { ClusterBounds, VisualizationSubgraph } from '@/types/visualization';
import { DEFAULT_HALF_HEIGHT, BORDER_COLOR as BORDER_CLR, RENDER_ORDER, LABEL_FONT_FAMILY, FLAT_ROTATION_X, DEFAULT_CANVAS_WIDTH } from './constants.js';
import { normalizeLabelText, roundRect } from './labelUtils.js';
import { createCanvasTexture } from './threeUtils.js';

const FLOOR_COLOR = 0xf0f4f8;
const FLOOR_OPACITY = 0.3;
const BORDER_OPACITY = 0.5;
const FALLBACK_PADDING = 0.8;
const LABEL_MIN_HEIGHT = 1.28;
const LABEL_VERTICAL_PADDING = 0.6;
const LABEL_BASE_Y = 0.72;
const LABEL_FORWARD_OFFSET = 0.52;
const TOP_LABEL_Y_OFFSET = 0.06;

interface SubgraphEntry {
  group: THREE.Group;
  topLabelPlane: THREE.Mesh;
}

interface DisposableObject3D extends THREE.Object3D {
  geometry?: { dispose: () => void };
  material?: THREE.Material | THREE.Material[];
}

function createFloorLabelTexture(text: string, fontSize: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  const cW = DEFAULT_CANVAS_WIDTH;
  const cH = 512;
  canvas.width = cW;
  canvas.height = cH;
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

  const safeLines = normalizeLabelText(text);
  const lineHeight = Math.round(fontSize * 1.25);
  const textBlockHeight = lineHeight * safeLines.length;
  const startY = cH / 2 - textBlockHeight / 2 + lineHeight / 2;
  const underlineOffset = Math.round(textBlockHeight / 2 + fontSize * 0.2);
  const cardPaddingY = Math.max(40, Math.round(fontSize * 0.8));
  const cardHeight = Math.min(cH - 64, textBlockHeight + cardPaddingY * 2);
  const cardY = Math.round((cH - cardHeight) / 2);

  ctx.clearRect(0, 0, cW, cH);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.86)';
  roundRect(ctx, 24, cardY, cW - 48, cardHeight, 36);
  ctx.fill();
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.32)';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = 'rgba(51, 65, 85, 0.85)';
  ctx.font = `700 ${fontSize}px ${LABEL_FONT_FAMILY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const [index, line] of safeLines.entries()) {
    ctx.fillText(line, cW / 2, startY + index * lineHeight, cW - 60);
  }

  const lineW = Math.min(
    Math.max(...safeLines.map((line) => ctx.measureText(line).width), 0),
    cW - 60,
  );
  ctx.strokeStyle = 'rgba(51, 65, 85, 0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo((cW - lineW) / 2, cH / 2 + underlineOffset);
  ctx.lineTo((cW + lineW) / 2, cH / 2 + underlineOffset);
  ctx.stroke();

  const texture = createCanvasTexture(canvas);
  return texture;
}

export class SubgraphRenderer {
  scene: THREE.Scene;
  group: THREE.Group;
  subgraphs: Map<string, SubgraphEntry>;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.userData.isSubgraphGroup = true;
    this.scene.add(this.group);
    this.subgraphs = new Map();
  }

  render(
    subgraphs: Map<string, VisualizationSubgraph> | undefined,
    nodeSubgraphs: Map<string, string>,
    resourceMeshes: Map<string, THREE.Group>,
    clusterBounds?: Map<string, ClusterBounds>,
    showFloor = true,
  ): void {
    this.clear();

    if (!subgraphs || subgraphs.size === 0) return;

    const membersBySg = new Map<string, string[]>();
    for (const sg of subgraphs.values()) {
      membersBySg.set(sg.id, []);
    }
    for (const [nodeId, sgId] of nodeSubgraphs) {
      if (membersBySg.has(sgId) && resourceMeshes.has(nodeId)) {
        membersBySg.get(sgId)?.push(nodeId);
      }
    }

    for (const sg of subgraphs.values()) {
      const members = membersBySg.get(sg.id);
      if (!members || members.length === 0) continue;

      let minX: number;
      let maxX: number;
      let minZ: number;
      let maxZ: number;

      // Use SVG-derived cluster bounds if available, otherwise compute from node positions
      const svgBounds = clusterBounds?.get(sg.id);
      if (svgBounds) {
        minX = svgBounds.minX;
        maxX = svgBounds.maxX;
        minZ = svgBounds.minZ;
        maxZ = svgBounds.maxZ;
      } else {
        minX = Infinity;
        maxX = -Infinity;
        minZ = Infinity;
        maxZ = -Infinity;
        for (const nodeId of members) {
          const mesh = resourceMeshes.get(nodeId);
          if (!mesh) continue;
          const p = mesh.position;
          minX = Math.min(minX, p.x);
          maxX = Math.max(maxX, p.x);
          minZ = Math.min(minZ, p.z);
          maxZ = Math.max(maxZ, p.z);
        }
      }

      const width = maxX - minX + (svgBounds ? 0 : FALLBACK_PADDING * 2);
      const depth = maxZ - minZ + (svgBounds ? 0 : FALLBACK_PADDING * 2);
      const cx = (minX + maxX) / 2;
      const cz = (minZ + maxZ) / 2;
      let topY = 0;

      for (const nodeId of members) {
        const mesh = resourceMeshes.get(nodeId);
        if (!mesh) continue;
        const halfHeight = Number((mesh.userData as { halfHeight?: number }).halfHeight ?? DEFAULT_HALF_HEIGHT);
        topY = Math.max(topY, mesh.position.y + halfHeight);
      }

      const sgGroup = new THREE.Group();

      if (showFloor) {
        // Floor plane (底面のみ)
        const floorGeo = new THREE.PlaneGeometry(width, depth);
        const floorMat = new THREE.MeshBasicMaterial({
          color: FLOOR_COLOR,
          transparent: true,
          opacity: FLOOR_OPACITY,
          depthWrite: false,
          side: THREE.DoubleSide,
        });
        const floorMesh = new THREE.Mesh(floorGeo, floorMat);
        floorMesh.rotation.x = FLAT_ROTATION_X;
        floorMesh.position.set(cx, 0.01, cz);
        sgGroup.add(floorMesh);

        // Border outline (底面の枠線)
        const borderGeo = new THREE.EdgesGeometry(floorGeo);
        const borderMat = new THREE.LineBasicMaterial({
          color: BORDER_CLR,
          transparent: true,
          opacity: BORDER_OPACITY,
        });
        const border = new THREE.LineSegments(borderGeo, borderMat);
        border.rotation.x = FLAT_ROTATION_X;
        border.position.set(cx, 0.01, cz);
        sgGroup.add(border);
      }

      const title = sg.title || sg.id;
      const titleLines = normalizeLabelText(title);

      const planeW = Math.min(
        Math.max(
          svgBounds?.labelWidth ? svgBounds.labelWidth * 1.75 : width * (members.length === 1 ? 1.4 : 0.6),
          4.4,
        ),
        Math.max(width - 0.2, 4.4),
      );
      const planeH = Math.max(
        svgBounds?.labelHeight
          ? svgBounds.labelHeight * (titleLines.length > 1 ? 2.5 : 2.1)
          : LABEL_MIN_HEIGHT + (titleLines.length - 1) * 0.68,
        LABEL_MIN_HEIGHT,
      );

      // Normalize font size so text appears at consistent world-space height
      const TEXT_TARGET_HEIGHT = 0.92;
      const fontSize = Math.min(220, Math.max(46, Math.round(TEXT_TARGET_HEIGHT / planeH * 512)));
      const floorTex = createFloorLabelTexture(title, fontSize);

      const labelGeo = new THREE.PlaneGeometry(planeW, planeH);
      const labelMat = new THREE.MeshBasicMaterial({
        map: floorTex,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        side: THREE.DoubleSide,
      });
      const labelX = svgBounds?.labelCenterX ?? cx;
      const labelZBase = svgBounds?.labelCenterZ ?? cz + depth / 2 - planeH * 0.15;
      const labelY = Math.max(LABEL_BASE_Y, topY + LABEL_VERTICAL_PADDING);
      void labelZBase;
      void labelY;

      const topLabelPlane = new THREE.Mesh(labelGeo.clone(), labelMat.clone());
      const topLabelMaterial = topLabelPlane.material as THREE.MeshBasicMaterial;
      topLabelMaterial.map = floorTex;
      topLabelPlane.rotation.x = FLAT_ROTATION_X;
      topLabelPlane.position.set(
        labelX,
        labelY + TOP_LABEL_Y_OFFSET,
        svgBounds?.labelCenterZ ?? cz,
      );
      topLabelPlane.userData.isLabel = true;
      topLabelPlane.userData.labelRole = 'subgraph';
      topLabelPlane.renderOrder = RENDER_ORDER.CONNECTION_LABEL;
      sgGroup.add(topLabelPlane);

      this.group.add(sgGroup);
      this.subgraphs.set(sg.id, { group: sgGroup, topLabelPlane });
    }
  }

  clear(): void {
    for (const entry of this.subgraphs.values()) {
      this.group.remove(entry.group);
      entry.group.traverse((child) => {
        const object = child as DisposableObject3D;
        object.geometry?.dispose();
        if (!object.material) return;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) {
          (material as THREE.Material & { map?: THREE.Texture | null }).map?.dispose();
          material.dispose();
        }
      });
    }
    this.subgraphs.clear();
  }

  dispose(): void {
    this.clear();
    this.scene.remove(this.group);
  }
}
