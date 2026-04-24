import * as THREE from 'three';
import type { VisualizationFlatDiagram } from '@/types/visualization';

const BASE_Y = 0.02;
const MAX_TEXTURE_WIDTH = 4096;
const MAX_TEXTURE_HEIGHT = 4096;

interface FlatDiagramEntry {
  group: THREE.Group;
  texture: THREE.CanvasTexture;
}

export class FlatDiagramRenderer {
  scene: THREE.Scene;
  group: THREE.Group;
  current: FlatDiagramEntry | null;
  renderVersion: number;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.userData.isFlatDiagramGroup = true;
    this.scene.add(this.group);
    this.current = null;
    this.renderVersion = 0;
  }

  async render(diagram: VisualizationFlatDiagram | undefined): Promise<void> {
    const version = ++this.renderVersion;
    this._clearCurrent();
    if (!diagram) return;

    const texture = await this._createTexture(
      diagram.svg,
      diagram.sourceWidth,
      diagram.sourceHeight,
    );
    if (version !== this.renderVersion) {
      texture.dispose();
      return;
    }

    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(diagram.width, diagram.height),
      new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(
      (diagram.bounds.minX + diagram.bounds.maxX) / 2,
      BASE_Y,
      (diagram.bounds.minZ + diagram.bounds.maxZ) / 2,
    );

    const group = new THREE.Group();
    group.add(plane);
    this.group.add(group);
    this.current = { group, texture };
  }

  clear(): void {
    this.renderVersion += 1;
    this._clearCurrent();
  }

  dispose(): void {
    this.clear();
    this.scene.remove(this.group);
  }

  private _clearCurrent(): void {
    if (!this.current) return;
    this.group.remove(this.current.group);
    this.current.group.traverse((child) => {
      const mesh = child as THREE.Mesh;
      mesh.geometry?.dispose();
      if (!mesh.material) return;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materials) {
        material.dispose();
      }
    });
    this.current.texture.dispose();
    this.current = null;
  }

  private async _createTexture(svg: string, width: number, height: number): Promise<THREE.CanvasTexture> {
    const scale = Math.min(
      2,
      MAX_TEXTURE_WIDTH / Math.max(width, 1),
      MAX_TEXTURE_HEIGHT / Math.max(height, 1),
    );
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('FlatDiagramRenderer: failed to create 2D canvas context');
    }

    const encoded = new XMLSerializer().serializeToString(
      new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement,
    );
    const blob = new Blob([encoded], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    try {
      const image = await this._loadImage(url);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    } finally {
      URL.revokeObjectURL(url);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    return texture;
  }

  private _loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = 'async';
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('FlatDiagramRenderer: failed to decode SVG image'));
      image.src = url;
    });
  }
}
