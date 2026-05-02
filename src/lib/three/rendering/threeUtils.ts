/**
 * Shared Three.js utilities: dispose, canvas texture, bounding box helpers.
 */
import * as THREE from 'three';

/**
 * Recursively dispose all geometry, material, and texture resources in a Three.js object tree.
 */
export function disposeObject3D(object: THREE.Object3D): void {
  object.traverse((child) => {
    const obj = child as THREE.Object3D & {
      geometry?: { dispose: () => void };
      material?: THREE.Material | THREE.Material[];
    };
    obj.geometry?.dispose();
    if (!obj.material) return;
    const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const material of materials) {
      const mat = material as THREE.Material & { map?: THREE.Texture | null };
      mat.map?.dispose();
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
