import type * as THREE from 'three';

export type VisualizationResourceStatus = 'idle' | 'active' | 'complete' | 'error' | (string & {});
export type VisualizationNodeShape = 'default' | 'sphere' | 'cylinder' | 'diamond' | 'torus' | (string & {});
export type VisualizationConnectionType =
  | 'ownership'
  | 'network'
  | 'storage'
  | 'config'
  | 'sync'
  | 'async'
  | 'signal'
  | (string & {});
export type VisualizationTrafficType = 'healthy' | 'error' | 'slow' | 'default' | (string & {});

export interface VisualizationNode {
  id: string;
  name: string;
  type: string;
  shape: VisualizationNodeShape;
  status: VisualizationResourceStatus;
  color: number;
  x: number;
  y: number;
  z: number;
  dataIn?: string;
  dataOut?: string;
  floatOffset: number;
  glowOffset: number;
  animate?: (time: number, delta?: number) => void;
}

export interface VisualizationConnection {
  id: string;
  sourceId: string;
  targetId: string;
  type?: VisualizationConnectionType;
  trafficVolume?: number;
  _label?: string | null;
}

export interface VisualizationRoute {
  id: string;
  sourceId: string;
  targetId: string;
  sourcePos?: THREE.Vector3 | { x: number; y: number; z: number };
  targetPos?: THREE.Vector3 | { x: number; y: number; z: number };
  payload?: string;
  trafficType?: VisualizationTrafficType;
  requestRate?: number;
  active?: boolean;
}

export interface VisualizationResourceTimelineKeyframe {
  time: number;
  type: 'resource';
  id: string;
  status: VisualizationResourceStatus;
  caption?: string;
}

export interface VisualizationRouteTimelineKeyframe {
  time: number;
  type: 'route';
  id: string;
  active: boolean;
  caption?: string;
}

export type VisualizationTimelineKeyframe =
  | VisualizationResourceTimelineKeyframe
  | VisualizationRouteTimelineKeyframe;

export interface VisualizationTimeline {
  duration: number;
  keyframes: VisualizationTimelineKeyframe[];
}

export interface VisualizationCamera {
  position: [number, number, number];
  target: [number, number, number];
}

export interface VisualizationSubgraph {
  id: string;
  title: string;
  order?: number;
}

export interface ViewConfig {
  nodes: VisualizationNode[];
  connections: VisualizationConnection[];
  timeline: VisualizationTimeline;
  buildRoutes: (meshes: Map<string, THREE.Group>) => VisualizationRoute[];
  camera: VisualizationCamera | null;
  subgraphs: Map<string, VisualizationSubgraph>;
  nodeSubgraphs: Map<string, string>;
}
