/**
 * Unified camera framing calculation.
 * Single Source of Truth for computing camera position/target from a bounding box.
 */
import * as THREE from 'three';
import {
  CAMERA_FOV,
  CAMERA_ELEVATION_DEG,
  CAMERA_Y_OFFSET,
  CAMERA_FRAME_PADDING,
  CAMERA_BOUNDS_PADDING,
  CAMERA_MIN_SPAN,
} from './constants.js';

export interface BoundingBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface CameraPosition {
  position: THREE.Vector3;
  target: THREE.Vector3;
}

/**
 * Compute the framing camera position and target for a bounding box.
 * This is the authoritative calculation used by both MermaidParser and ClusterRenderer.
 */
export function calculateFramingCamera(
  bounds: BoundingBox,
  aspect: number,
): CameraPosition {
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cz = (bounds.minZ + bounds.maxZ) / 2;

  const paddedWidth = Math.max(bounds.maxX - bounds.minX + CAMERA_BOUNDS_PADDING, CAMERA_MIN_SPAN);
  const paddedDepth = Math.max(bounds.maxZ - bounds.minZ + CAMERA_BOUNDS_PADDING, CAMERA_MIN_SPAN);

  const halfFov = THREE.MathUtils.degToRad(CAMERA_FOV) / 2;
  const tanHalfFov = Math.tan(halfFov);
  const safeAspect = aspect || 1;

  const distanceForWidth = (paddedWidth / 2) / Math.max(tanHalfFov * safeAspect, 0.001);
  const distanceForDepth = (paddedDepth / 2) / Math.max(tanHalfFov, 0.001);
  const distance = Math.max(distanceForWidth, distanceForDepth, 15) * CAMERA_FRAME_PADDING;

  const elevation = THREE.MathUtils.degToRad(CAMERA_ELEVATION_DEG);

  const target = new THREE.Vector3(cx, 0, cz);
  const position = new THREE.Vector3(
    cx,
    distance * Math.sin(elevation) + CAMERA_Y_OFFSET,
    cz + distance * Math.cos(elevation),
  );

  return { position, target };
}

/**
 * Lightweight version that returns a serializable camera view (for MermaidParser output).
 */
export function calculateCameraView(
  bounds: BoundingBox,
  aspect: number,
): { position: [number, number, number]; target: [number, number, number] } {
  const { position, target } = calculateFramingCamera(bounds, aspect);
  return {
    position: [position.x, position.y, position.z],
    target: [target.x, target.y, target.z],
  };
}

/**
 * Compute bounding box from an iterable of 2D positions.
 */
export function computeBoundingBox(
  items: Iterable<{ x: number; z: number }>,
): BoundingBox {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const item of items) {
    if (item.x < minX) minX = item.x;
    if (item.x > maxX) maxX = item.x;
    if (item.z < minZ) minZ = item.z;
    if (item.z > maxZ) maxZ = item.z;
  }
  return { minX, maxX, minZ, maxZ };
}
