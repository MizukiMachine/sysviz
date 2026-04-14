declare module '@/lib/three/rendering/ClusterRenderer.js' {
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

declare module '@/lib/three/rendering/SubgraphRenderer.js' {
  export class SubgraphRenderer {
    constructor(scene: any);
    render(subgraphs: any, nodeSubgraphs: any, meshes: any): void;
    clear(): void;
    dispose(): void;
  }
}

declare module '@/lib/three/engine/PlaybackEngine.js' {
  export class PlaybackEngine {
    state: string;
    elapsed: number;
    duration: number;
    steps: any[];
    constructor(timeline: any, callbacks: any);
    play(): void;
    stop(): void;
    next(): void;
    prev(): void;
    update(delta: number): void;
  }
}

declare module '@/lib/three/parser/MermaidParser.js' {
  type ViewConfig = import('@/types/visualization').ViewConfig;

  export class MermaidParser {
    parse(url: string): Promise<ViewConfig>;
    parseText(text: string): ViewConfig;
  }
}
