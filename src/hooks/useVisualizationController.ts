import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_VIEW,
  BUILTIN_PROJECTS,
  isGitLabView,
  resolveGitLabFilePath,
} from '@/lib/views/viewRegistry';
import type { Canvas3DHandle } from '@/components/Canvas3D';
import type { ViewConfig } from '@/types/visualization';
import type { GitLabService } from '@/lib/gitlab/GitLabService';

interface UseVisualizationControllerArgs {
  canvasRef: React.RefObject<Canvas3DHandle | null>;
  gitLabService?: GitLabService | null;
}

export function useVisualizationController({
  canvasRef,
  gitLabService,
}: UseVisualizationControllerArgs) {
  const [selectedProject, setSelectedProject] = useState<string>(BUILTIN_PROJECTS[0].id);
  const [selectedDiagram, setSelectedDiagram] = useState<string>(BUILTIN_PROJECTS[0].diagrams[0].id);
  const [disabledDiagrams, setDisabledDiagrams] = useState<Set<string>>(new Set());
  const [viewCache, setViewCache] = useState<Map<string, ViewConfig>>(new Map());
  const [rawMmdText, setRawMmdText] = useState<string>('');
  const [isLoadingView, setIsLoadingView] = useState(false);
  const initializedRef = useRef(false);
  const parseImportRef = useRef<Promise<typeof import('@/lib/three/parser/MermaidParser.js')> | null>(null);

  const getParser = useCallback(() => {
    if (!parseImportRef.current) {
      parseImportRef.current = import('@/lib/three/parser/MermaidParser.js');
    }
    return parseImportRef.current;
  }, []);

  const fetchView = useCallback(async (diagramId: string, signal?: AbortSignal): Promise<ViewConfig> => {
    const { MermaidParser } = await getParser();
    const parser = new MermaidParser();

    // Find the diagram entry across all projects and GitLab views
    const allDiagrams = BUILTIN_PROJECTS.flatMap((p) => [...p.diagrams]);
    const builtinDiagram = allDiagrams.find((d) => d.id === diagramId);

    if (builtinDiagram && builtinDiagram.filePath) {
      const data = await parser.parse(builtinDiagram.filePath);
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      return data;
    }

    if (isGitLabView(diagramId)) {
      if (!gitLabService) throw new Error('GitLab service is not available');
      return parser.parseText(await gitLabService.fetchMmdFile(resolveGitLabFilePath(diagramId), signal));
    }

    // Fallback: empty parse
    return parser.parseText('');
  }, [getParser, gitLabService]);

  // Initial fetch for default diagram
  useEffect(() => {
    const ac = new AbortController();
    const defaultDiagramId = BUILTIN_PROJECTS[0].diagrams[0].id;
    setIsLoadingView(true);
    fetchView(defaultDiagramId, ac.signal)
      .then((data) => {
        if (!ac.signal.aborted) {
          setViewCache(new Map([[defaultDiagramId, data]]));
          setRawMmdText(data.rawMmdText ?? '');
        }
      })
      .catch((err) => {
        if (!ac.signal.aborted) {
          console.warn('Mermaid parse failed:', err);
          setDisabledDiagrams(new Set([defaultDiagramId]));
        }
      })
      .finally(() => {
        if (!ac.signal.aborted) setIsLoadingView(false);
      });
    return () => ac.abort();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadView = useCallback(
    (diagramId: string) => {
      const canvas = canvasRef.current;
      if (!canvas?.renderer) return;
      const viewConfig = viewCache.get(diagramId);
      if (!viewConfig) return;

      canvas.loadView(viewConfig);
    },
    [canvasRef, viewCache]
  );

  // Poll for renderer readiness, then do first loadView
  useEffect(() => {
    if (initializedRef.current) return;
    const cached = viewCache.get(selectedDiagram);
    if (!cached) return;

    let cancelled = false;
    let pollTimer: number | null = null;
    let attempts = 0;

    const poll = () => {
      if (cancelled) return;
      if (canvasRef.current?.renderer) {
        initializedRef.current = true;
        loadView(selectedDiagram);
        return;
      }
      attempts += 1;
      if (attempts < 100) {
        pollTimer = window.setTimeout(poll, 100);
        return;
      }
      initializedRef.current = true;
      loadView(selectedDiagram);
    };

    pollTimer = window.setTimeout(poll, 100);
    return () => {
      cancelled = true;
      if (pollTimer !== null) window.clearTimeout(pollTimer);
    };
  }, [canvasRef, loadView, selectedDiagram, viewCache]);

  // Handle diagram switching
  useEffect(() => {
    if (!initializedRef.current) return;

    const cached = viewCache.get(selectedDiagram);
    if (cached) {
      loadView(selectedDiagram);
      setRawMmdText(cached.rawMmdText ?? '');
      return;
    }

    const ac = new AbortController();
    setIsLoadingView(true);
    fetchView(selectedDiagram, ac.signal)
      .then((data) => {
        if (!ac.signal.aborted) {
          setViewCache((prev) => new Map(prev).set(selectedDiagram, data));
          setRawMmdText(data.rawMmdText ?? '');
        }
      })
      .catch((err) => {
        if (!ac.signal.aborted) {
          console.warn(`Failed to load diagram ${selectedDiagram}:`, err);
          setDisabledDiagrams((prev) => new Set(prev).add(selectedDiagram));
        }
      })
      .finally(() => {
        if (!ac.signal.aborted) setIsLoadingView(false);
      });
    return () => ac.abort();
  }, [selectedDiagram, viewCache, fetchView, loadView]);

  const handleProjectChange = useCallback(
    (projectId: string) => {
      const project = BUILTIN_PROJECTS.find((p) => p.id === projectId);
      if (project) {
        setSelectedProject(projectId);
        const firstDiagram = project.diagrams[0];
        if (firstDiagram) {
          initializedRef.current = true;
          setSelectedDiagram(firstDiagram.id);
        }
      }
    },
    []
  );

  const handleDiagramChange = useCallback(
    (diagramId: string) => {
      initializedRef.current = true;
      setSelectedDiagram(diagramId);
    },
    []
  );

  const mermaidView = viewCache.get(selectedDiagram) ?? null;

  return {
    selectedProject,
    selectedDiagram,
    disabledDiagrams,
    mermaidView,
    rawMmdText,
    isLoadingView,
    handleProjectChange,
    handleDiagramChange,
  };
}
