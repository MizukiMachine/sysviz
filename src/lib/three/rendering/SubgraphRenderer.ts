import * as THREE from 'three';
import type { ClusterBounds, VisualizationSubgraph } from '@/types/visualization';

const FLOOR_COLOR = 0xf0f4f8;
const FLOOR_OPACITY = 0.3;
const BORDER_COLOR = 0x94a3b8;
const BORDER_OPACITY = 0.5;
const PADDING = 0.8;

interface SubgraphEntry {
  group: THREE.Group;
  floorPlane: THREE.Mesh;
}

interface DisposableObject3D extends THREE.Object3D {
  geometry?: { dispose: () => void };
  material?: THREE.Material | THREE.Material[];
}

function createFloorLabelTexture(text: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  const cW = 1024;
  const cH = 512;
  canvas.width = cW;
  canvas.height = cH;
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

  ctx.clearRect(0, 0, cW, cH);
  ctx.fillStyle = 'rgba(51, 65, 85, 0.85)';
  ctx.font = '700 48px "Inter", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, cW / 2, cH / 2, cW - 60);

  const metrics = ctx.measureText(text);
  const lineW = Math.min(metrics.width, cW - 60);
  ctx.strokeStyle = 'rgba(51, 65, 85, 0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo((cW - lineW) / 2, cH / 2 + 32);
  ctx.lineTo((cW + lineW) / 2, cH / 2 + 32);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
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

      const width = maxX - minX + PADDING * 2;
      const depth = maxZ - minZ + PADDING * 2;
      const cx = (minX + maxX) / 2;
      const cz = (minZ + maxZ) / 2;

      const sgGroup = new THREE.Group();

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
      floorMesh.rotation.x = -Math.PI / 2;
      floorMesh.position.set(cx, 0.01, cz);
      sgGroup.add(floorMesh);

      // Border outline (底面の枠線)
      const borderGeo = new THREE.EdgesGeometry(floorGeo);
      const borderMat = new THREE.LineBasicMaterial({
        color: BORDER_COLOR,
        transparent: true,
        opacity: BORDER_OPACITY,
      });
      const border = new THREE.LineSegments(borderGeo, borderMat);
      border.rotation.x = -Math.PI / 2;
      border.position.set(cx, 0.01, cz);
      sgGroup.add(border);

      const title = sg.title || sg.id;
      const floorTex = createFloorLabelTexture(title);

      const scaleFactor = members.length === 1 ? 1.8 : 1;
      const texAspect = 2;
      let planeW: number;
      let planeD: number;
      if ((width * scaleFactor) / (depth * scaleFactor) > texAspect) {
        planeD = depth * scaleFactor;
        planeW = planeD * texAspect;
      } else {
        planeW = width * scaleFactor;
        planeD = planeW / texAspect;
      }

      const labelGeo = new THREE.PlaneGeometry(planeW, planeD);
      const labelMat = new THREE.MeshBasicMaterial({
        map: floorTex,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const floorPlane = new THREE.Mesh(labelGeo, labelMat);
      floorPlane.rotation.x = -Math.PI / 2;
      floorPlane.position.set(cx, 0.02, cz + depth * 0.25);
      floorPlane.userData.isLabel = true;
      floorPlane.renderOrder = 1;
      sgGroup.add(floorPlane);

      this.group.add(sgGroup);
      this.subgraphs.set(sg.id, { group: sgGroup, floorPlane });
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
