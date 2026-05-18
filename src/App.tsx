import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MessageCircle, RefreshCw } from 'lucide-react';
import { Canvas3D, type Canvas3DHandle } from './components/Canvas3D';
import { ProjectSelector } from './components/ProjectSelector';
import { DiagramSwitcher } from './components/DiagramSwitcher';
import { InteractionHint } from './components/InteractionHint';
import { useChat } from './hooks/useChat';
import { useVisualizationController } from './hooks/useVisualizationController';
import { BUILTIN_PROJECTS, createGitLabProject, deriveLabel, type Project } from './lib/views/viewRegistry';
import { useGitLab } from './hooks/useGitLab';

const ChatPanel = lazy(() =>
  import('./components/ChatPanel').then((module) => ({ default: module.ChatPanel }))
);

interface AppProps {
  dataPath?: string;
  glmPath?: string;
}

interface SysvizDataManifest {
  projects?: Array<{
    id?: string;
    label?: string;
    diagrams?: Array<{
      id?: string;
      label?: string;
      filePath?: string;
      diagramType?: string;
    }>;
  }>;
}

function normalizeDataPath(dataPath?: string): string {
  const normalized = (dataPath || '/data').replace(/\/+$/, '');
  return normalized || '/data';
}

function normalizeDataManifest(manifest: SysvizDataManifest): Project[] {
  return (manifest.projects ?? [])
    .map((project, projectIndex) => {
      const projectId = project.id || `local-${projectIndex + 1}`;
      const diagrams = (project.diagrams ?? [])
        .filter((diagram) => typeof diagram.filePath === 'string' && diagram.filePath.length > 0)
        .map((diagram) => {
          const rawDiagramId = diagram.id || diagram.filePath!;
          const diagramId = rawDiagramId.startsWith(`${projectId}/`)
            ? rawDiagramId
            : `${projectId}/${rawDiagramId}`;
          const entry = {
            id: diagramId,
            label: diagram.label || '',
            filePath: diagram.filePath,
            diagramType: diagram.diagramType === 'sequence' ? ('sequence' as const) : ('flowchart' as const),
          };
          return {
            ...entry,
            label: entry.label || deriveLabel(entry),
          };
        });

      return {
        id: projectId,
        label: project.label || 'Local Diagrams',
        diagrams,
      };
    })
    .filter((project) => project.diagrams.length > 0);
}

export default function App({ dataPath }: AppProps) {
  const canvasRef = useRef<Canvas3DHandle>(null);
  const refreshAbortRef = useRef<AbortController | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [dataProjects, setDataProjects] = useState<readonly Project[] | null>(null);
  const [useBuiltinProjects, setUseBuiltinProjects] = useState(true);
  const [isRefreshingData, setIsRefreshingData] = useState(false);
  const [dataRefreshError, setDataRefreshError] = useState<string | null>(null);
  const [dataRefreshToken, setDataRefreshToken] = useState(0);
  const chat = useChat();
  const gitLab = useGitLab();
  const normalizedDataPath = useMemo(() => normalizeDataPath(dataPath), [dataPath]);

  const loadDataProjects = useCallback(async (signal: AbortSignal): Promise<Project[]> => {
    const response = await fetch(`${normalizedDataPath}/`, { signal, cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`SysViz data manifest fetch failed: ${response.status}`);
    }
    const manifest = await response.json() as SysvizDataManifest;
    return normalizeDataManifest(manifest);
  }, [normalizedDataPath]);

  useEffect(() => {
    const ac = new AbortController();
    loadDataProjects(ac.signal)
      .then((projects) => {
        if (!ac.signal.aborted) {
          setDataProjects(projects);
          setUseBuiltinProjects(false);
          setDataRefreshError(null);
        }
      })
      .catch((err) => {
        if (!ac.signal.aborted) {
          console.warn('SysViz data manifest fetch failed:', err);
          setDataProjects([]);
          setUseBuiltinProjects(true);
          setDataRefreshError(err instanceof Error ? err.message : String(err));
        }
      });

    return () => ac.abort();
  }, [loadDataProjects]);

  useEffect(() => () => {
    refreshAbortRef.current?.abort();
  }, []);

  const handleRefreshData = useCallback(async () => {
    if (isRefreshingData) return;
    refreshAbortRef.current?.abort();
    const ac = new AbortController();
    refreshAbortRef.current = ac;
    setIsRefreshingData(true);
    setDataRefreshError(null);

    try {
      const projects = await loadDataProjects(ac.signal);
      if (ac.signal.aborted) return;
      setDataProjects(projects);
      setUseBuiltinProjects(false);
      setDataRefreshToken((token) => token + 1);
    } catch (err) {
      if (!ac.signal.aborted) {
        console.warn('SysViz data refresh failed:', err);
        setDataRefreshError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      if (!ac.signal.aborted) {
        setIsRefreshingData(false);
        refreshAbortRef.current = null;
      }
    }
  }, [isRefreshingData, loadDataProjects]);

  const gitLabProjects = useMemo(() =>
    gitLab.manifest?.diagrams.map((diagram) => createGitLabProject(diagram)) ?? [],
    [gitLab.manifest]
  );

  const baseProjects = useMemo(
    () => useBuiltinProjects ? BUILTIN_PROJECTS : (dataProjects ?? []),
    [dataProjects, useBuiltinProjects]
  );

  const allProjects = useMemo(
    () => [...baseProjects, ...gitLabProjects],
    [baseProjects, gitLabProjects]
  );

  const {
    selectedProject,
    selectedDiagram,
    disabledDiagrams,
    getLabel,
    translationError,
    handleProjectChange,
    handleDiagramChange,
    mermaidView,
    rawMmdText,
    isLoadingView,
  } = useVisualizationController({
    canvasRef,
    projects: allProjects,
    gitLabService: gitLab.configured ? gitLab.service : null,
    refreshToken: dataRefreshToken,
  });

  return (
    <div className="relative w-full h-full overflow-hidden">
      <Canvas3D ref={canvasRef} />

      <ProjectSelector
        projects={allProjects}
        value={selectedProject}
        onChange={handleProjectChange}
      />
      <InteractionHint />

      <DiagramSwitcher
        projects={allProjects}
        projectId={selectedProject}
        value={selectedDiagram}
        onChange={handleDiagramChange}
        disabledOptions={disabledDiagrams}
        getLabel={getLabel}
      />

      <button
        onClick={handleRefreshData}
        disabled={isRefreshingData}
        type="button"
        className={`
          fixed top-5 right-24 z-30 w-14 h-14 flex items-center justify-center rounded-full glass-panel
          cursor-pointer text-slate-600 hover:text-slate-800 hover:shadow-lg transition-all
          disabled:cursor-default disabled:opacity-70
          ${dataRefreshError ? 'ring-2 ring-rose-300/70 text-rose-600' : ''}
        `}
        aria-label="Refresh SysViz diagrams"
        title={dataRefreshError ?? 'Refresh SysViz diagrams'}
      >
        <RefreshCw size={23} className={isRefreshingData ? 'animate-spin' : ''} />
      </button>

      {isLoadingView && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-48 z-20 pointer-events-none select-none">
          <div className="rounded-full bg-white/70 backdrop-blur-sm shadow px-4 py-1.5 flex items-center gap-2">
            <div className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-medium text-slate-500">
              読み込み中...
            </span>
          </div>
        </div>
      )}

      {/* Chat toggle button */}
      {!isChatOpen && (
        <button
          onClick={() => setIsChatOpen(true)}
          className="fixed top-5 right-5 z-30 w-14 h-14 flex items-center justify-center rounded-full glass-panel cursor-pointer text-slate-600 hover:text-slate-800 hover:shadow-lg transition-all"
          aria-label="Open chat"
        >
          <MessageCircle size={24} />
        </button>
      )}

      {/* Chat panel */}
      {isChatOpen && (
        <Suspense fallback={null}>
          <ChatPanel
            viewConfig={mermaidView}
            rawMmdText={rawMmdText}
            onClose={() => setIsChatOpen(false)}
            messages={chat.messages}
            isLoading={chat.isLoading}
            error={chat.error}
            settings={chat.settings}
            gitLabSettings={gitLab.settings}
            onSendMessage={(text) => chat.sendMessage(text, selectedDiagram, mermaidView, rawMmdText)}
            onStopStreaming={chat.stopStreaming}
            onClearChat={chat.clearChat}
            onUpdateSettings={chat.updateSettings}
            onUpdateGitLabSettings={gitLab.updateSettings}
          />
        </Suspense>
      )}
    </div>
  );
}
