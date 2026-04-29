import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { Canvas3D, type Canvas3DHandle } from './components/Canvas3D';
import { ProjectSelector } from './components/ProjectSelector';
import { DiagramSwitcher } from './components/DiagramSwitcher';
import { useChat } from './hooks/useChat';
import { useVisualizationController } from './hooks/useVisualizationController';
import { BUILTIN_PROJECTS } from './lib/views/viewRegistry';
import { useGitLab } from './hooks/useGitLab';

const ChatPanel = lazy(() =>
  import('./components/ChatPanel').then((module) => ({ default: module.ChatPanel }))
);

export default function App() {
  const canvasRef = useRef<Canvas3DHandle>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const chat = useChat();
  const gitLab = useGitLab();

  // Convert GitLab views to extra projects for ProjectSelector
  const gitLabProjects = useMemo(() =>
    gitLab.views.map((view) => ({
      id: view.value,
      label: view.label,
      diagrams: [{
        id: view.value,
        label: view.label,
        filePath: view.filePath,
        diagramType: view.diagramType,
      }],
    })),
    [gitLab.views]
  );

  const allProjects = useMemo(
    () => [...BUILTIN_PROJECTS, ...gitLabProjects],
    [gitLabProjects]
  );

  const {
    selectedProject,
    selectedDiagram,
    disabledDiagrams,
    handleProjectChange,
    handleDiagramChange,
    mermaidView,
    rawMmdText,
    isLoadingView,
  } = useVisualizationController({
    canvasRef,
    gitLabService: gitLab.configured ? gitLab.service : null,
  });

  // If selected project no longer exists, reset to first available
  useEffect(() => {
    if (allProjects.some((p) => p.id === selectedProject)) return;
    if (allProjects.length > 0) {
      handleProjectChange(allProjects[0].id);
    }
  }, [allProjects, selectedProject, handleProjectChange]);

  return (
    <div className="relative w-full h-full overflow-hidden">
      <Canvas3D ref={canvasRef} />

      <ProjectSelector
        value={selectedProject}
        onChange={handleProjectChange}
        extraProjects={gitLabProjects}
      />

      <DiagramSwitcher
        projectId={selectedProject}
        value={selectedDiagram}
        onChange={handleDiagramChange}
        disabledOptions={disabledDiagrams}
      />

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
