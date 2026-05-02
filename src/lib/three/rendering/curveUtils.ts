/**
 * Unified curve building for connection lines and particle traffic.
 */
import * as THREE from 'three';
import type { VisualizationPathPoint } from '@/types/visualization';
import {
  CURVE_ARCH_FACTOR,
  CURVE_MAX_HEIGHT,
  FLOWCHART_EDGE_Y,
} from './constants.js';

/**
 * Build a 3D curve from two endpoints, with optional intermediate path points.
 * Uses CatmullRomCurve3 for multi-point paths and QuadraticBezierCurve3 for
 * simple two-point connections with an arched midpoint.
 */
export function buildConnectionCurve(
  sourcePos: THREE.Vector3,
  targetPos: THREE.Vector3,
  pathPoints?: VisualizationPathPoint[] | null,
): THREE.Curve<THREE.Vector3> {
  if (pathPoints && pathPoints.length >= 2) {
    const lifted = liftPathPoints(pathPoints);
    if (lifted.length === 2) {
      return new THREE.LineCurve3(lifted[0], lifted[1]);
    }
    return new THREE.CatmullRomCurve3(lifted, false, 'centripetal');
  }

  const midpoint = new THREE.Vector3().lerpVectors(sourcePos, targetPos, 0.5);
  const distance = sourcePos.distanceTo(targetPos);
  midpoint.y += Math.min(distance * CURVE_ARCH_FACTOR, CURVE_MAX_HEIGHT);
  return new THREE.QuadraticBezierCurve3(sourcePos, midpoint, targetPos);
}

/**
 * Lift path points to the flowchart floating edge Y level.
 */
export function liftPathPoints(points: VisualizationPathPoint[]): THREE.Vector3[] {
  return points.map((point) => new THREE.Vector3(point.x, FLOWCHART_EDGE_Y, point.z));
}
