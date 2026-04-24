import * as THREE from 'three';
import type { VisualizationFlatDiagram } from '@/types/visualization';

const BASE_Y = 0.02;
const MAX_TEXTURE_WIDTH = 4096;
const MAX_TEXTURE_HEIGHT = 4096;

interface FlatDiagramEntry {
  group: THREE.Group;
  texture: THREE.Texture;
  objectUrl: string | null;
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
    this.current = { group, texture, objectUrl: texture.userData.objectUrl ?? null };
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
    if (this.current.objectUrl) {
      URL.revokeObjectURL(this.current.objectUrl);
    }
    this.current = null;
  }

  private async _createTexture(svg: string, width: number, height: number): Promise<THREE.Texture> {
    const encoded = new XMLSerializer().serializeToString(
      new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement,
    );
    const blob = new Blob([encoded], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const image = await this._loadImage(url);
    const texture = new THREE.Texture(image);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    texture.userData = { sourceWidth: width, sourceHeight: height, objectUrl: url };
    return texture;
  }

  private _loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.decoding = 'async';
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('FlatDiagramRenderer: failed to decode SVG image'));
      image.src = url;
    });
  }
}
