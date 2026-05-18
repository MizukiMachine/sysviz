import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BUILTIN_PROJECTS,
  deriveLabel,
  isGitLabView,
  type Project,
  resolveGitLabFilePath,
} from '@/lib/views/viewRegistry';
import type { Canvas3DHandle } from '@/components/Canvas3D';
import type { ViewConfig } from '@/types/visualization';
import type { GitLabService } from '@/lib/gitlab/GitLabService';
import { translateLabels } from '@/lib/llm/LabelTranslator';

interface UseVisualizationControllerArgs {
  canvasRef: React.RefObject<Canvas3DHandle | null>;
  projects: readonly Project[];
  gitLabService?: GitLabService | null;
  refreshToken?: number;
}

export function useVisualizationController({
  canvasRef,
  projects,
  gitLabService,
  refreshToken = 0,
}: UseVisualizationControllerArgs) {
  const fallbackProject = projects[0] ?? BUILTIN_PROJECTS[0];
  const fallbackDiagram = fallbackProject?.diagrams[0] ?? BUILTIN_PROJECTS[0].diagrams[0];
  const [selectedProject, setSelectedProject] = useState<string>(fallbackProject.id);
  const [selectedDiagram, setSelectedDiagram] = useState<string>(fallbackDiagram.id);
  const [disabledDiagrams, setDisabledDiagrams] = useState<Set<string>>(new Set());
  const [viewCache, setViewCache] = useState<Map<string, ViewConfig>>(new Map());
  const [labelTranslations, setLabelTranslations] = useState<Map<string, string>>(new Map());
  const [translationError, setTranslationError] = useState<string | null>(null);
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

  const findProject = useCallback(
    (projectId: string) => projects.find((project) => project.id === projectId) ?? null,
    [projects]
  );

  const findDiagram = useCallback(
    (diagramId: string) => {
      for (const project of projects) {
        const diagram = project.diagrams.find((entry) => entry.id === diagramId);
        if (diagram) return diagram;
      }
      return null;
    },
    [projects]
  );

  const fetchView = useCallback(async (diagramId: string, signal?: AbortSignal): Promise<ViewConfig> => {
    const { MermaidParser } = await getParser();
    const parser = new MermaidParser();

    const diagram = findDiagram(diagramId);

    if (diagram?.filePath && !isGitLabView(diagramId)) {
      const data = await parser.parse(diagram.filePath);
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      return data;
    }

    if (isGitLabView(diagramId)) {
      if (!gitLabService) throw new Error('GitLab service is not available');
      return parser.parseText(await gitLabService.fetchMmdFile(resolveGitLabFilePath(diagramId), signal));
    }

    // Fallback: empty parse
    return parser.parseText('');
  }, [findDiagram, getParser, gitLabService]);

  useEffect(() => {
    if (refreshToken === 0) return;
    initializedRef.current = true;
    setDisabledDiagrams(new Set());
    setViewCache(new Map());
    setLabelTranslations(new Map());
    setTranslationError(null);
    setRawMmdText('');
  }, [refreshToken]);

  // Initial fetch for default diagram
  useEffect(() => {
    const ac = new AbortController();
    const defaultDiagramId = fallbackDiagram.id;
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
  }, [fallbackDiagram.id, fetchView]);

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

  // Translate diagram labels when project changes
  useEffect(() => {
    const project = findProject(selectedProject);
    if (!project) return;

    const labels = project.diagrams.map((d) => deriveLabel(d));
    const ac = new AbortController();
    setTranslationError(null);

    translateLabels(labels, ac.signal).then((translations) => {
      if (!ac.signal.aborted) {
        setLabelTranslations(translations);
      }
    }).catch((err) => {
      if (!ac.signal.aborted) {
        setTranslationError(err instanceof Error ? err.message : String(err));
      }
    });

    return () => ac.abort();
  }, [findProject, selectedProject]);

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

  useEffect(() => {
    const project = findProject(selectedProject);
    if (!project) {
      if (fallbackProject) {
        setSelectedProject(fallbackProject.id);
        const nextDiagram = fallbackProject.diagrams[0];
        if (nextDiagram) {
          setSelectedDiagram(nextDiagram.id);
        }
      }
      return;
    }

    const hasSelectedDiagram = project.diagrams.some((diagram) => diagram.id === selectedDiagram);
    if (!hasSelectedDiagram) {
      const nextDiagram = project.diagrams.find((diagram) => !disabledDiagrams.has(diagram.id))
        ?? project.diagrams[0];
      if (nextDiagram) {
        setSelectedDiagram(nextDiagram.id);
      }
    }
  }, [disabledDiagrams, fallbackProject, findProject, selectedDiagram, selectedProject]);

  const handleProjectChange = useCallback(
    (projectId: string) => {
      const project = findProject(projectId);
      if (project) {
        setSelectedProject(projectId);
        const nextDiagram = project.diagrams.find((diagram) => !disabledDiagrams.has(diagram.id))
          ?? project.diagrams[0];
        if (nextDiagram) {
          initializedRef.current = true;
          setSelectedDiagram(nextDiagram.id);
        }
      }
    },
    [disabledDiagrams, findProject]
  );

  const handleDiagramChange = useCallback(
    (diagramId: string) => {
      if (disabledDiagrams.has(diagramId)) return;
      initializedRef.current = true;
      setSelectedDiagram(diagramId);
    },
    [disabledDiagrams]
  );

  const mermaidView = viewCache.get(selectedDiagram) ?? null;

  const getLabel = useCallback(
    (diagramId: string) => {
      const project = findProject(selectedProject);
      const diagram = project?.diagrams.find((d) => d.id === diagramId);
      if (!diagram) return diagramId;
      const base = deriveLabel(diagram);
      return labelTranslations.get(base) ?? base;
    },
    [findProject, selectedProject, labelTranslations]
  );

  return {
    selectedProject,
    selectedDiagram,
    disabledDiagrams,
    getLabel,
    translationError,
    mermaidView,
    rawMmdText,
    isLoadingView,
    handleProjectChange,
    handleDiagramChange,
  };
}
