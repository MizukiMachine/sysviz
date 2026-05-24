/**
 * Shared Three.js utilities: dispose, canvas texture, bounding box helpers.
 */
import * as THREE from 'three';

/**
 * Recursively dispose all geometry, material, and texture resources in a Three.js object tree.
 */
export function disposeObject3D(object: THREE.Object3D): void {
  const disposedGeometries = new Set<{ dispose: () => void }>();
  const disposedMaterials = new Set<THREE.Material>();
  const disposedTextures = new Set<THREE.Texture>();

  object.traverse((child) => {
    const obj = child as THREE.Object3D & {
      geometry?: { dispose: () => void };
      material?: THREE.Material | THREE.Material[];
    };
    if (obj.geometry && !disposedGeometries.has(obj.geometry)) {
      disposedGeometries.add(obj.geometry);
      obj.geometry.dispose();
    }
    if (!obj.material) return;
    const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const material of materials) {
      if (disposedMaterials.has(material)) continue;
      disposedMaterials.add(material);
      for (const value of Object.values(material as unknown as Record<string, unknown>)) {
        const texture = value as THREE.Texture | null;
        if (texture?.isTexture && !disposedTextures.has(texture)) {
          disposedTextures.add(texture);
          texture.dispose();
        }
      }
      material.dispose();
    }
  });
}

/**
 * Create a CanvasTexture with consistent settings.
 */
export function createCanvasTexture(
  canvas: HTMLCanvasElement,
  options?: {
    colorSpace?: THREE.ColorSpace;
    generateMipmaps?: boolean;
  },
): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.colorSpace = options?.colorSpace ?? THREE.SRGBColorSpace;
  if (options?.generateMipmaps !== undefined) {
    texture.generateMipmaps = options.generateMipmaps;
  }
  return texture;
}
