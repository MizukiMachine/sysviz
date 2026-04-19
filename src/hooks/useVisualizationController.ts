import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_VIEW,
  MERMAID_PATHS,
  type VisualizationKey,
} from '@/lib/views/viewRegistry';
import type { Canvas3DHandle } from '@/components/Canvas3D';
import type { ViewConfig } from '@/types/visualization';
import { enrichCaptions } from '@/lib/llm/CaptionGenerator';
import { loadSettings, getActiveConfig } from '@/lib/llm/SettingsService';

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
  const [viewCache, setViewCache] = useState<Map<VisualizationKey, ViewConfig>>(new Map());
  const [rawMmdText, setRawMmdText] = useState<string>('');
  const [isEnriching, setIsEnriching] = useState(false);
  const [isLoadingView, setIsLoadingView] = useState(false);
  const initializedRef = useRef(false);
  const parseImportRef = useRef<Promise<typeof import('@/lib/three/parser/MermaidParser.js')> | null>(null);

  const getParser = useCallback(() => {
    if (!parseImportRef.current) {
      parseImportRef.current = import('@/lib/three/parser/MermaidParser.js');
    }
    return parseImportRef.current;
  }, []);

  const fetchView = useCallback(async (viewKey: VisualizationKey, signal?: AbortSignal): Promise<ViewConfig> => {
    const path = MERMAID_PATHS[viewKey];
    const { MermaidParser } = await getParser();
    const data = await new MermaidParser().parse(path);

    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    const config = getActiveConfig(loadSettings());
    if (!config) return data;

    setIsEnriching(true);
    try {
      const enriched = await enrichCaptions(data, config, signal);
      if (!signal?.aborted) return enriched;
      return data;
    } catch (e) {
      console.warn('Caption enrichment failed, using template captions:', e);
      return data;
    } finally {
      if (!signal?.aborted) setIsEnriching(false);
    }
  }, [getParser]);

  // Initial fetch for DEFAULT_VIEW
  useEffect(() => {
    const ac = new AbortController();
    setIsLoadingView(true);
    fetchView(DEFAULT_VIEW, ac.signal)
      .then((data) => {
        if (!ac.signal.aborted) {
          setViewCache(new Map([[DEFAULT_VIEW, data]]));
          setRawMmdText(data.rawMmdText ?? '');
        }
      })
      .catch((err) => {
        if (!ac.signal.aborted) {
          console.warn('Mermaid parse failed:', err);
          setDisabledOptions(new Set([DEFAULT_VIEW]));
        }
      })
      .finally(() => {
        if (!ac.signal.aborted) setIsLoadingView(false);
      });
    return () => ac.abort();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadView = useCallback(
    (viewName: VisualizationKey) => {
      const canvas = canvasRef.current;
      if (!canvas?.renderer) return;
      const viewConfig = viewCache.get(viewName);
      if (!viewConfig) return;

      stop();
      canvas.loadView(viewConfig);
      initEngine(canvas.renderer, viewConfig.timeline);
    },
    [canvasRef, initEngine, viewCache, stop]
  );

  // Poll for renderer readiness, then do first loadView
  useEffect(() => {
    if (initializedRef.current) return;
    const cached = viewCache.get(selectedView);
    if (!cached) return;

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
      if (attempts < 100) {
        pollTimer = window.setTimeout(poll, 100);
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
  }, [canvasRef, loadView, selectedView, viewCache]);

  // Handle view switching
  useEffect(() => {
    if (!initializedRef.current) return;

    const cached = viewCache.get(selectedView);
    if (cached) {
      loadView(selectedView);
      setRawMmdText(cached.rawMmdText ?? '');
      return;
    }

    const ac = new AbortController();
    setIsLoadingView(true);
    fetchView(selectedView, ac.signal)
      .then((data) => {
        if (!ac.signal.aborted) {
          setViewCache((prev) => new Map(prev).set(selectedView, data));
          setRawMmdText(data.rawMmdText ?? '');
        }
      })
      .catch((err) => {
        if (!ac.signal.aborted) {
          console.warn(`Failed to load view ${selectedView}:`, err);
          setDisabledOptions((prev) => new Set(prev).add(selectedView));
        }
      })
      .finally(() => {
        if (!ac.signal.aborted) setIsLoadingView(false);
      });
    return () => ac.abort();
  }, [selectedView, viewCache, fetchView, loadView]);

  const handleViewChange = useCallback(
    (viewName: VisualizationKey) => {
      initializedRef.current = true;
      stop();
      setSelectedView(viewName);
    },
    [stop]
  );

  const mermaidView = viewCache.get(selectedView) ?? null;

  return {
    disabledOptions,
    selectedView,
    handleViewChange,
    mermaidView,
    rawMmdText,
    isEnriching,
    isLoadingView,
  };
}
