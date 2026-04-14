import { useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import type { ClusterRenderer } from '@/lib/three/rendering/ClusterRenderer.js';
import type { SubgraphRenderer } from '@/lib/three/rendering/SubgraphRenderer.js';
import type { ViewConfig } from '@/types/visualization';

export interface Canvas3DHandle {
  renderer: ClusterRenderer | null;
  subgraphRenderer: SubgraphRenderer | null;
  loadView: (view: ViewConfig) => void;
  clearScene: () => void;
}

export const Canvas3D = forwardRef<Canvas3DHandle>((_, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<ClusterRenderer | null>(null);
  const subgraphRef = useRef<SubgraphRenderer | null>(null);

  useImperativeHandle(ref, () => ({
    get renderer() {
      return rendererRef.current;
    },
    get subgraphRenderer() {
      return subgraphRef.current;
    },
    loadView,
    clearScene,
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;
    let cleanup: (() => void) | undefined;

    // Ensure canvas has full viewport size before ClusterRenderer reads it
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';

    void Promise.all([
      import('@/lib/three/rendering/ClusterRenderer.js'),
      import('@/lib/three/rendering/SubgraphRenderer.js'),
    ]).then(([clusterModule, subgraphModule]) => {
      if (disposed) return;

      const renderer = new clusterModule.ClusterRenderer(canvas);
      const subgraphRenderer = new subgraphModule.SubgraphRenderer(renderer.scene);
      rendererRef.current = renderer;
      subgraphRef.current = subgraphRenderer;

      renderer.start();
      cleanup = () => {
        renderer.stop();
        renderer.dispose();
        subgraphRenderer.dispose();
        rendererRef.current = null;
        subgraphRef.current = null;
      };
    });

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, []);

  const clearScene = useCallback(() => {
    const renderer = rendererRef.current;
    const sg = subgraphRef.current;
    if (!renderer || !sg) return;

    for (const id of [...renderer.resourceMeshes.keys()]) {
      renderer.removeResource(id);
    }
    for (const id of [...renderer.connectionLines.connections.keys()]) {
      renderer.connectionLines.removeConnection(id);
    }
    for (const id of [...renderer.particleTraffic.routes.keys()]) {
      renderer.particleTraffic.removeRoute(id);
    }
    sg.clear();
  }, []);

  const loadView = useCallback(
    (view: ViewConfig) => {
      const renderer = rendererRef.current;
      const sg = subgraphRef.current;
      if (!renderer || !sg) return;

      // Reset playback state
      for (const id of [...renderer.resourceMeshes.keys()]) {
        renderer.setResourceStatus(id, 'idle');
      }
      for (const conn of view.connections) {
        renderer.setTrafficRouteActive(`route-${conn.id}`, false);
        renderer.setConnectionActive(conn.id, false);
      }
      renderer.clearTrafficParticles();

      clearScene();

      // Load new data
      for (const node of view.nodes) {
        renderer.addResource(node);
      }
      for (const conn of view.connections) {
        renderer.addConnection(conn);
      }
      const routes = view.buildRoutes(renderer.resourceMeshes);
      for (const route of routes) {
        renderer.addTrafficRoute(route);
      }

      if (view.subgraphs && view.subgraphs.size > 0) {
        sg.render(view.subgraphs, view.nodeSubgraphs ?? new Map(), renderer.resourceMeshes);
      }

      if (view.camera) {
        renderer.camera.position.set(...view.camera.position);
        renderer.controls.target.set(...view.camera.target);
      } else {
        renderer.resetCamera();
      }
      renderer.controls.update();
    },
    [clearScene]
  );

  return (
    <canvas
      ref={canvasRef}
      id="cluster-canvas"
      aria-label="3D cluster canvas"
    />
  );
});

Canvas3D.displayName = 'Canvas3D';
