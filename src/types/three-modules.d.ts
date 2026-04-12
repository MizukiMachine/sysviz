declare module '@/lib/three/rendering/ClusterRenderer' {
  export class ClusterRenderer {
    constructor(canvas: HTMLCanvasElement);
    scene: any;
    camera: any;
    controls: any;
    resourceMeshes: Map<string, any>;
    connectionLines: any;
    particleTraffic: any;
    lockDrag: boolean;
    onAnimate: ((delta: number) => void) | null;
    addResource(resource: any): void;
    removeResource(id: string): void;
    setResourceStatus(id: string, status: string): void;
    addConnection(connection: any): void;
    removeConnection(id: string): void;
    setTrafficRouteActive(id: string, active: boolean): void;
    setConnectionActive(id: string, active: boolean): void;
    addTrafficRoute(route: any): void;
    clearTrafficParticles(): void;
    flyTo(targetPos: any, cameraPos: any, duration: number): void;
    resetCamera(): void;
    dispose(): void;
    start(): void;
    stop(): void;
  }
}

declare module '@/lib/three/rendering/SubgraphRenderer' {
  export class SubgraphRenderer {
    constructor(scene: any);
    render(subgraphs: any, nodeSubgraphs: any, meshes: any): void;
    clear(): void;
    dispose(): void;
  }
}

declare module '@/lib/three/engine/PlaybackEngine' {
  export class PlaybackEngine {
    state: string;
    elapsed: number;
    duration: number;
    steps: any[];
    constructor(timeline: any, callbacks: any);
    play(): void;
    pause(): void;
    stop(): void;
    next(): void;
    prev(): void;
    update(delta: number): void;
    setTimeline(timeline: any): void;
  }
}

declare module '@/lib/three/data/FlaskFlow' {
  export const FLASK_NODES: any[];
  export const FLASK_CONNECTIONS: any[];
  export const FLASK_TIMELINE: any;
  export function buildTrafficRoutes(meshes: any): any[];
}

declare module '@/lib/three/data/FlaskDataFlow' {
  export const DATA_FLOW_NODES: any[];
  export const DATA_FLOW_CONNECTIONS: any[];
  export const DATA_FLOW_TIMELINE: any;
  export const DATA_FLOW_CAMERA: any;
  export function buildTrafficRoutes(meshes: any): any[];
}

declare module '@/lib/three/data/FlaskSequence' {
  export const SEQUENCE_NODES: any[];
  export const SEQUENCE_CONNECTIONS: any[];
  export const SEQUENCE_TIMELINE: any;
  export const SEQUENCE_CAMERA: any;
  export function buildTrafficRoutes(meshes: any): any[];
}

declare module '@/lib/three/parser/MermaidParser' {
  export class MermaidParser {
    parse(url: string): Promise<any>;
    parseText(text: string): any;
  }
}
