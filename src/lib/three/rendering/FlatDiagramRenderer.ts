import * as THREE from 'three';
import type { VisualizationFlatDiagram } from '@/types/visualization';

const BASE_Y = 0.02;

interface FlatDiagramEntry {
  group: THREE.Group;
  texture: THREE.Texture;
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
    if (!diagram) return;

    const texture = await this._createTexture(
      diagram.svg,
      diagram.sourceWidth,
      diagram.sourceHeight,
    );
    if (version !== this.renderVersion) {
      this._disposeTexture(texture);
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
    this._clearCurrent();
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
    this._disposeTexture(this.current.texture);
    this.current = null;
  }

  private async _createTexture(svg: string, width: number, height: number): Promise<THREE.Texture> {
    const normalizedSvg = this._normalizeSvg(svg, width, height);
    const rasterSource = await this._rasterizeSvg(normalizedSvg, width, height);
    const texture = new THREE.Texture(rasterSource);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    texture.userData = { sourceWidth: width, sourceHeight: height };
    return texture;
  }

  private _normalizeSvg(svg: string, width: number, height: number): string {
    const svgDoc = new DOMParser().parseFromString(svg, 'image/svg+xml');
    const svgEl = svgDoc.documentElement;
    svgEl.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svgEl.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    if (!svgEl.getAttribute('viewBox')) {
      svgEl.setAttribute('viewBox', `0 0 ${width} ${height}`);
    }
    svgEl.setAttribute('width', String(width));
    svgEl.setAttribute('height', String(height));
    svgEl.querySelectorAll('script').forEach((node) => node.remove());
    return new XMLSerializer().serializeToString(svgEl);
  }

  private async _rasterizeSvg(svg: string, width: number, height: number): Promise<CanvasImageSource> {
    const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    return this._loadImage(dataUrl, width, height);
  }

  private _loadImage(url: string, width: number, height: number): Promise<HTMLCanvasElement> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.decoding = 'async';
      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('FlatDiagramRenderer: failed to create canvas context'));
          return;
        }
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(image, 0, 0, width, height);
        resolve(canvas);
      };
      image.onerror = () => reject(new Error('FlatDiagramRenderer: failed to decode SVG image'));
      image.src = url;
    });
  }

  private _disposeTexture(texture: THREE.Texture): void {
    const sourceData = texture.source.data;
    texture.dispose();
    if (sourceData && typeof ImageBitmap !== 'undefined' && sourceData instanceof ImageBitmap) {
      sourceData.close();
    }
  }
}
