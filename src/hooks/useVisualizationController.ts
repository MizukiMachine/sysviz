import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_VIEW,
  MERMAID_DATA_FLOW_PATH,
  type VisualizationKey,
} from '@/lib/views/viewRegistry';
import type { Canvas3DHandle } from '@/components/Canvas3D';
import type { PlaybackInfo } from '@/hooks/usePlayback';
import type { ViewConfig } from '@/types/visualization';

interface UseVisualizationControllerArgs {
  canvasRef: React.RefObject<Canvas3DHandle | null>;
  initEngine: (renderer: NonNullable<Canvas3DHandle['renderer']>, timeline: ViewConfig['timeline']) => unknown;
  stop: () => void;
}

export function useVisualizationController({
  canvasRef,
  initEngine,
  stop,
}: UseVisualizationControllerArgs) {
  const [selectedView, setSelectedView] = useState<VisualizationKey>(DEFAULT_VIEW);
  const [disabledOptions, setDisabledOptions] = useState<Set<VisualizationKey>>(new Set());
  const [mermaidView, setMermaidView] = useState<ViewConfig | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void import('@/lib/three/parser/MermaidParser.js')
      .then(({ MermaidParser }) => {
        const mermaidParser = new MermaidParser();
        return mermaidParser.parse(MERMAID_DATA_FLOW_PATH);
      })
      .then((data: ViewConfig) => {
        if (!cancelled) setMermaidView(data);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.warn('Mermaid parse failed:', error);
        setDisabledOptions(new Set([DEFAULT_VIEW]));
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const loadView = useCallback(
    (viewName: VisualizationKey) => {
      const canvas = canvasRef.current;
      if (!canvas?.renderer) return;

      stop();

      if (viewName !== DEFAULT_VIEW || !mermaidView) return;

      canvas.loadView(mermaidView);
      initEngine(canvas.renderer, mermaidView.timeline);
    },
    [canvasRef, initEngine, mermaidView, stop]
  );

  useEffect(() => {
    if (initializedRef.current) return;
    if (selectedView === DEFAULT_VIEW && !mermaidView) return;

    let cancelled = false;
    let pollTimer: number | null = null;
    let attempts = 0;

    const poll = () => {
      if (cancelled) return;

      if (canvasRef.current?.renderer) {
        initializedRef.current = true;
        loadView(selectedView);
        return;
      }

      attempts += 1;
      if (attempts < 20) {
        pollTimer = window.setTimeout(poll, 50);
        return;
      }

      initializedRef.current = true;
      loadView(selectedView);
    };

    pollTimer = window.setTimeout(poll, 100);

    return () => {
      cancelled = true;
      if (pollTimer !== null) window.clearTimeout(pollTimer);
    };
  }, [canvasRef, loadView, mermaidView, selectedView]);

  useEffect(() => {
    if (!initializedRef.current) return;
    loadView(selectedView);
  }, [loadView, selectedView]);

  const handleViewChange = useCallback(
    (viewName: VisualizationKey) => {
      initializedRef.current = true;
      stop();
      setSelectedView(viewName);
    },
    [stop]
  );

  return {
    disabledOptions,
    selectedView,
    handleViewChange,
  };
}
