import type * as THREE from 'three';

export interface VisualizationNode {
  id: string;
  [key: string]: unknown;
}

export interface VisualizationConnection {
  id: string;
  [key: string]: unknown;
}

export interface VisualizationRoute {
  id: string;
  sourceId: string;
  targetId: string;
  [key: string]: unknown;
}

export interface VisualizationTimeline {
  duration: number;
  keyframes: Array<Record<string, unknown>>;
}

export interface VisualizationCamera {
  position: [number, number, number];
  target: [number, number, number];
}

export interface VisualizationSubgraph {
  id: string;
  title: string;
  order?: number;
  [key: string]: unknown;
}

export interface ViewConfig {
  nodes: VisualizationNode[];
  connections: VisualizationConnection[];
  timeline: VisualizationTimeline;
  buildRoutes: (meshes: Map<string, THREE.Group>) => VisualizationRoute[];
  camera: VisualizationCamera | null;
  subgraphs?: Map<string, VisualizationSubgraph>;
  nodeSubgraphs?: Map<string, string>;
}
