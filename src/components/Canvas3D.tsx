import { useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import type { ClusterRenderer } from '@/lib/three/rendering/ClusterRenderer.js';
import type { FlatDiagramRenderer } from '@/lib/three/rendering/FlatDiagramRenderer.js';
import type { SequenceParticipantRenderer } from '@/lib/three/rendering/SequenceParticipantRenderer.js';
import type { SubgraphRenderer } from '@/lib/three/rendering/SubgraphRenderer.js';
import type { ViewConfig } from '@/types/visualization';

export interface Canvas3DHandle {
  renderer: ClusterRenderer | null;
  subgraphRenderer: SubgraphRenderer | null;
  flatDiagramRenderer: FlatDiagramRenderer | null;
  sequenceParticipantRenderer: SequenceParticipantRenderer | null;
  loadView: (view: ViewConfig) => Promise<void>;
  clearScene: () => void;
}

export const Canvas3D = forwardRef<Canvas3DHandle>((_, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<ClusterRenderer | null>(null);
  const subgraphRef = useRef<SubgraphRenderer | null>(null);
  const flatDiagramRef = useRef<FlatDiagramRenderer | null>(null);
  const sequenceParticipantRef = useRef<SequenceParticipantRenderer | null>(null);

  useImperativeHandle(ref, () => ({
    get renderer() {
      return rendererRef.current;
    },
    get subgraphRenderer() {
      return subgraphRef.current;
    },
    get flatDiagramRenderer() {
      return flatDiagramRef.current;
    },
    get sequenceParticipantRenderer() {
      return sequenceParticipantRef.current;
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
      import('@/lib/three/rendering/FlatDiagramRenderer.js'),
      import('@/lib/three/rendering/SequenceParticipantRenderer.js'),
      import('@/lib/three/rendering/SubgraphRenderer.js'),
    ]).then(([clusterModule, flatDiagramModule, sequenceParticipantModule, subgraphModule]) => {
      if (disposed) return;

      const renderer = new clusterModule.ClusterRenderer(canvas);
      const flatDiagramRenderer = new flatDiagramModule.FlatDiagramRenderer(renderer.scene);
      const sequenceParticipantRenderer = new sequenceParticipantModule.SequenceParticipantRenderer(renderer.scene);
      const subgraphRenderer = new subgraphModule.SubgraphRenderer(renderer.scene);
      rendererRef.current = renderer;
      flatDiagramRef.current = flatDiagramRenderer;
      sequenceParticipantRef.current = sequenceParticipantRenderer;
      subgraphRef.current = subgraphRenderer;

      renderer.start();
      cleanup = () => {
        renderer.stop();
        renderer.dispose();
        flatDiagramRenderer.dispose();
        sequenceParticipantRenderer.dispose();
        subgraphRenderer.dispose();
        rendererRef.current = null;
        flatDiagramRef.current = null;
        sequenceParticipantRef.current = null;
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
    const flat = flatDiagramRef.current;
    const sequenceParticipants = sequenceParticipantRef.current;
    if (!renderer || !sg || !flat || !sequenceParticipants) return;

    for (const id of [...renderer.resourceMeshes.keys()]) {
      renderer.removeResource(id);
    }
    for (const id of [...renderer.connectionLines.connections.keys()]) {
      renderer.connectionLines.removeConnection(id);
    }
    for (const id of [...renderer.particleTraffic.routes.keys()]) {
      renderer.particleTraffic.removeRoute(id);
    }
    renderer.clusterBounds = undefined;
    sg.clear();
    flat.clear();
    sequenceParticipants.clear();
  }, []);

  const clearOverlays = useCallback(() => {
    const renderer = rendererRef.current;
    const sg = subgraphRef.current;
    const sequenceParticipants = sequenceParticipantRef.current;
    if (!renderer || !sg || !sequenceParticipants) return;

    for (const id of [...renderer.resourceMeshes.keys()]) {
      renderer.removeResource(id);
    }
    for (const id of [...renderer.connectionLines.connections.keys()]) {
      renderer.connectionLines.removeConnection(id);
    }
    for (const id of [...renderer.particleTraffic.routes.keys()]) {
      renderer.particleTraffic.removeRoute(id);
    }
    renderer.clusterBounds = undefined;
    sg.clear();
    sequenceParticipants.clear();
  }, []);

  const loadView = useCallback(
    async (view: ViewConfig) => {
      const renderer = rendererRef.current;
      const sg = subgraphRef.current;
      const flat = flatDiagramRef.current;
      const sequenceParticipants = sequenceParticipantRef.current;
      if (!renderer || !sg || !flat || !sequenceParticipants) return;

      // Reset playback state
      for (const id of [...renderer.resourceMeshes.keys()]) {
        renderer.setResourceStatus(id, 'idle');
      }
      for (const conn of view.connections) {
        renderer.setTrafficRouteActive(`route-${conn.id}`, false);
        renderer.setConnectionActive(conn.id, false);
      }
      renderer.clearTrafficParticles();

      clearOverlays();

      if (view.flatDiagram) {
        await flat.render(view.flatDiagram);
      } else {
        flat.clear();
      }
      sequenceParticipants.render(view.sequenceParticipants);

      // Load new data
      for (const node of view.nodes) {
        renderer.addResource(node);
      }
      if (!view.flatDiagram) {
        for (const conn of view.connections) {
          renderer.addConnection(conn, view.clusterBounds);
        }
        const routes = view.buildRoutes(renderer.resourceMeshes);
        for (const route of routes) {
          renderer.addTrafficRoute(route);
        }
      }

      if (view.subgraphs.size > 0) {
        sg.render(
          view.subgraphs,
          view.nodeSubgraphs,
          renderer.resourceMeshes,
          view.clusterBounds,
          !view.flatDiagram,
        );
      }

      if (view.camera) {
        renderer.applyCamera(view.camera);
      } else if (view.flatDiagram) {
        renderer.frameBounds(view.flatDiagram.bounds);
      } else {
        renderer.frameResources(view.clusterBounds);
      }
    },
    [clearOverlays]
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
